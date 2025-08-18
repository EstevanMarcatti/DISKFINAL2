from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Enums
class DumpsterSize(str, Enum):
    PEQUENA = "Pequena"
    MEDIA = "Média"
    GRANDE = "Grande"

class RentalStatus(str, Enum):
    ACTIVE = "active"
    RETRIEVED = "retrieved"

# Models
class Client(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    address: str
    phone: Optional[str] = ""
    email: Optional[str] = ""
    additional_address: Optional[str] = ""
    notes: Optional[str] = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ClientCreate(BaseModel):
    name: str
    address: str
    phone: Optional[str] = ""
    email: Optional[str] = ""
    additional_address: Optional[str] = ""
    notes: Optional[str] = ""

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    additional_address: Optional[str] = None
    notes: Optional[str] = None

class DumpsterType(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    size: DumpsterSize
    volume: str
    price: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DumpsterTypeUpdate(BaseModel):
    price: float

class RentalNote(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_id: Optional[str] = None  # Optional for unregistered clients
    client_name: str
    client_address: str
    client_phone: Optional[str] = ""
    dumpster_code: str
    dumpster_size: DumpsterSize
    rental_date: datetime
    description: Optional[str] = ""
    status: RentalStatus = RentalStatus.ACTIVE
    is_paid: bool = False
    price: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RentalNoteCreate(BaseModel):
    client_id: Optional[str] = None  # Optional for unregistered clients
    client_name: Optional[str] = None  # For unregistered clients
    client_address: Optional[str] = None  # For unregistered clients
    client_phone: Optional[str] = ""
    dumpster_code: str
    dumpster_size: DumpsterSize
    rental_date: datetime
    description: Optional[str] = ""
    price: float

class Payment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    account_name: str
    amount: float
    due_date: datetime
    description: Optional[str] = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PaymentCreate(BaseModel):
    account_name: str
    amount: float
    due_date: datetime
    description: Optional[str] = ""

class Receivable(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_id: Optional[str] = None
    client_name: str
    rental_note_id: str
    dumpster_code: str
    amount: float
    received_date: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReceivableCreate(BaseModel):
    client_id: Optional[str] = None
    client_name: str
    rental_note_id: str
    dumpster_code: str
    amount: float
    received_date: datetime

# Helper functions
def prepare_for_mongo(data):
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, datetime):
                data[key] = value.isoformat()
    return data

def parse_from_mongo(item):
    if isinstance(item, dict):
        # Remove MongoDB ObjectId fields that cause serialization issues
        if '_id' in item:
            del item['_id']
        
        for key, value in item.items():
            if isinstance(value, str) and 'T' in value and ('Z' in value or '+' in value):
                try:
                    item[key] = datetime.fromisoformat(value.replace('Z', '+00:00'))
                except:
                    pass
    return item

def calculate_rental_status_color(rental_date: datetime, status: str):
    """Calculate the color status based on rental date and current status"""
    if status == "retrieved":
        return "red"
    
    now = datetime.now(timezone.utc)
    
    # Ensure rental_date has timezone info
    if rental_date.tzinfo is None:
        rental_date = rental_date.replace(tzinfo=timezone.utc)
    
    days_diff = (now - rental_date).days
    
    if days_diff <= 7:
        return "green"
    elif days_diff <= 30:
        return "yellow"
    else:
        return "purple"

# Initialize default dumpster types
@app.on_event("startup")
async def initialize_dumpster_types():
    existing_types = await db.dumpster_types.find().to_list(length=None)
    if not existing_types:
        default_types = [
            {"size": "Pequena", "volume": "1m³", "price": 150.0},
            {"size": "Média", "volume": "2,5m³", "price": 250.0},
            {"size": "Grande", "volume": "5m³", "price": 350.0}
        ]
        
        for dt in default_types:
            dumpster_type = DumpsterType(**dt)
            await db.dumpster_types.insert_one(prepare_for_mongo(dumpster_type.dict()))

# Client endpoints
@api_router.post("/clients", response_model=Client)
async def create_client(client_data: ClientCreate):
    client = Client(**client_data.dict())
    await db.clients.insert_one(prepare_for_mongo(client.dict()))
    return client

@api_router.get("/clients", response_model=List[Client])
async def get_clients():
    clients = await db.clients.find().to_list(length=None)
    return [Client(**parse_from_mongo(client)) for client in clients]

@api_router.get("/clients/{client_id}", response_model=Client)
async def get_client(client_id: str):
    client = await db.clients.find_one({"id": client_id})
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return Client(**parse_from_mongo(client))

@api_router.put("/clients/{client_id}", response_model=Client)
async def update_client(client_id: str, client_data: ClientUpdate):
    update_data = {k: v for k, v in client_data.dict().items() if v is not None}
    result = await db.clients.update_one({"id": client_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    
    updated_client = await db.clients.find_one({"id": client_id})
    return Client(**parse_from_mongo(updated_client))

@api_router.delete("/clients/{client_id}")
async def delete_client(client_id: str):
    result = await db.clients.delete_one({"id": client_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return {"message": "Cliente excluído com sucesso"}

@api_router.get("/clients/{client_id}/stats")
async def get_client_stats(client_id: str):
    # Get client rentals
    rentals = await db.rental_notes.find({"client_id": client_id}).to_list(length=None)
    
    total_rentals = len(rentals)
    paid_rentals = len([r for r in rentals if r.get('is_paid', False)])
    open_rentals = total_rentals - paid_rentals
    
    return {
        "total_dumpsters": total_rentals,
        "paid_dumpsters": paid_rentals,
        "open_dumpsters": open_rentals
    }

# Dumpster types endpoints
@api_router.get("/dumpster-types", response_model=List[DumpsterType])
async def get_dumpster_types():
    types = await db.dumpster_types.find().to_list(length=None)
    return [DumpsterType(**parse_from_mongo(dt)) for dt in types]

@api_router.put("/dumpster-types/{size}")
async def update_dumpster_price(size: str, price_data: DumpsterTypeUpdate):
    result = await db.dumpster_types.update_one(
        {"size": size},
        {"$set": {"price": price_data.price}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tipo de caçamba não encontrado")
    return {"message": "Preço atualizado com sucesso"}

# Rental notes endpoints
@api_router.post("/rental-notes", response_model=RentalNote)
async def create_rental_note(rental_data: RentalNoteCreate):
    rental_dict = rental_data.dict()
    
    # Handle registered client
    if rental_data.client_id:
        client = await db.clients.find_one({"id": rental_data.client_id})
        if not client:
            raise HTTPException(status_code=404, detail="Cliente não encontrado")
        rental_dict["client_name"] = client["name"]
        rental_dict["client_address"] = client["address"]
        rental_dict["client_phone"] = client.get("phone", "")
    # Handle unregistered client
    else:
        if not rental_data.client_name or not rental_data.client_address:
            raise HTTPException(status_code=400, detail="Nome e endereço são obrigatórios para clientes não cadastrados")
        rental_dict["client_name"] = rental_data.client_name
        rental_dict["client_address"] = rental_data.client_address
        rental_dict["client_phone"] = rental_data.client_phone or ""
    
    rental_note = RentalNote(**rental_dict)
    await db.rental_notes.insert_one(prepare_for_mongo(rental_note.dict()))
    return rental_note

@api_router.get("/rental-notes", response_model=List[RentalNote])
async def get_rental_notes():
    notes = await db.rental_notes.find().to_list(length=None)
    result = []
    for note in notes:
        parsed_note = parse_from_mongo(note)
        rental_note = RentalNote(**parsed_note)
        result.append(rental_note)
    return result

@api_router.get("/rental-notes/active")
async def get_active_rental_notes():
    notes = await db.rental_notes.find({"status": "active"}).to_list(length=None)
    result = []
    
    for note in notes:
        parsed_note = parse_from_mongo(note)
        rental_note = RentalNote(**parsed_note)
        
        # Calculate color status
        color_status = calculate_rental_status_color(
            rental_note.rental_date, 
            rental_note.status
        )
        
        note_with_status = rental_note.dict()
        note_with_status["color_status"] = color_status
        result.append(note_with_status)
    
    return result

@api_router.get("/rental-notes/retrieved")
async def get_retrieved_rental_notes():
    notes = await db.rental_notes.find({"status": "retrieved"}).to_list(length=None)
    result = []
    
    for note in notes:
        parsed_note = parse_from_mongo(note)
        rental_note = RentalNote(**parsed_note)
        
        note_with_status = rental_note.dict()
        note_with_status["color_status"] = "red"
        result.append(note_with_status)
    
    return result

@api_router.get("/rental-notes/overdue")
async def get_overdue_rental_notes():
    """Get rentals that are overdue (30+ days)"""
    notes = await db.rental_notes.find({"status": "active"}).to_list(length=None)
    result = []
    
    for note in notes:
        parsed_note = parse_from_mongo(note)
        rental_note = RentalNote(**parsed_note)
        
        # Calculate color status
        color_status = calculate_rental_status_color(
            rental_note.rental_date, 
            rental_note.status
        )
        
        # Only include purple (30+ days) rentals
        if color_status == "purple":
            note_with_status = rental_note.dict()
            note_with_status["color_status"] = color_status
            result.append(note_with_status)
    
    return result

@api_router.put("/rental-notes/{note_id}/retrieve")
async def mark_as_retrieved(note_id: str):
    result = await db.rental_notes.update_one(
        {"id": note_id},
        {"$set": {"status": "retrieved"}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Nota não encontrada")
    return {"message": "Caçamba marcada como retirada"}

@api_router.put("/rental-notes/{note_id}/pay")
async def mark_as_paid(note_id: str):
    # Get the rental note
    rental = await db.rental_notes.find_one({"id": note_id})
    if not rental:
        raise HTTPException(status_code=404, detail="Nota não encontrada")
    
    # Mark as paid
    await db.rental_notes.update_one(
        {"id": note_id},
        {"$set": {"is_paid": True}}
    )
    
    # Create automatic receivable record
    receivable_data = {
        "client_id": rental.get("client_id"),
        "client_name": rental["client_name"],
        "rental_note_id": note_id,
        "dumpster_code": rental["dumpster_code"],
        "amount": rental["price"],
        "received_date": datetime.now(timezone.utc)
    }
    
    receivable = Receivable(**receivable_data)
    await db.receivables.insert_one(prepare_for_mongo(receivable.dict()))
    
    return {"message": "Caçamba marcada como paga e recebimento registrado"}

@api_router.get("/rental-notes/with-status")
async def get_rental_notes_with_status():
    notes = await db.rental_notes.find().to_list(length=None)
    result = []
    
    for note in notes:
        parsed_note = parse_from_mongo(note)
        rental_note = RentalNote(**parsed_note)
        
        # Calculate color status
        color_status = calculate_rental_status_color(
            rental_note.rental_date, 
            rental_note.status
        )
        
        note_with_status = rental_note.dict()
        note_with_status["color_status"] = color_status
        result.append(note_with_status)
    
    return result

# Dashboard stats
@api_router.get("/dashboard/stats")
async def get_dashboard_stats():
    # Get all data
    clients = await db.clients.find().to_list(length=None)
    rentals = await db.rental_notes.find().to_list(length=None)
    payments = await db.payments.find().to_list(length=None)
    
    total_clients = len(clients)
    active_rentals = len([r for r in rentals if r.get('status') == 'active'])
    retrieved_rentals = len([r for r in rentals if r.get('status') == 'retrieved'])
    total_payments = len(payments)
    
    # Calculate overdue rentals (30+ days)
    overdue_count = 0
    for rental in rentals:
        if rental.get('status') == 'active':
            rental_date = rental.get('rental_date')
            if isinstance(rental_date, str):
                try:
                    rental_date = datetime.fromisoformat(rental_date.replace('Z', '+00:00'))
                except:
                    continue
            
            color_status = calculate_rental_status_color(rental_date, rental.get('status'))
            if color_status == 'purple':
                overdue_count += 1
    
    return {
        "total_clients": total_clients,
        "active_dumpsters": active_rentals,
        "retrieved_dumpsters": retrieved_rentals,
        "overdue_dumpsters": overdue_count,
        "total_payments": total_payments
    }

# Financial endpoints
@api_router.get("/financial/monthly-summary")
async def get_monthly_financial_summary():
    """Get current month financial summary"""
    now = datetime.now(timezone.utc)
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Get receivables for current month
    receivables = await db.receivables.find({}).to_list(length=None)
    monthly_receivables = []
    total_received = 0
    
    for receivable in receivables:
        received_date = receivable.get('received_date')
        if isinstance(received_date, str):
            try:
                received_date = datetime.fromisoformat(received_date.replace('Z', '+00:00'))
            except:
                continue
        
        if received_date >= start_of_month:
            monthly_receivables.append(parse_from_mongo(receivable))
            total_received += receivable.get('amount', 0)
    
    # Get payments for current month
    payments = await db.payments.find({}).to_list(length=None)
    monthly_payments = []
    total_paid = 0
    
    for payment in payments:
        due_date = payment.get('due_date')
        if isinstance(due_date, str):
            try:
                due_date = datetime.fromisoformat(due_date.replace('Z', '+00:00'))
            except:
                continue
        
        if due_date >= start_of_month:
            monthly_payments.append(parse_from_mongo(payment))
            total_paid += payment.get('amount', 0)
    
    return {
        "month": now.strftime("%B %Y"),
        "total_received": total_received,
        "total_paid": total_paid,
        "net_income": total_received - total_paid,
        "receivables": monthly_receivables,
        "payments": monthly_payments
    }

# Payment endpoints
@api_router.post("/payments", response_model=Payment)
async def create_payment(payment_data: PaymentCreate):
    payment = Payment(**payment_data.dict())
    await db.payments.insert_one(prepare_for_mongo(payment.dict()))
    return payment

@api_router.get("/payments", response_model=List[Payment])
async def get_payments():
    payments = await db.payments.find().to_list(length=None)
    return [Payment(**parse_from_mongo(payment)) for payment in payments]

# Receivable endpoints
@api_router.post("/receivables", response_model=Receivable)
async def create_receivable(receivable_data: ReceivableCreate):
    receivable = Receivable(**receivable_data.dict())
    await db.receivables.insert_one(prepare_for_mongo(receivable.dict()))
    return receivable

@api_router.get("/receivables", response_model=List[Receivable])
async def get_receivables():
    receivables = await db.receivables.find().to_list(length=None)
    return [Receivable(**parse_from_mongo(receivable)) for receivable in receivables]

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()