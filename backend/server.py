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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ClientCreate(BaseModel):
    name: str
    address: str

class DumpsterType(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    size: DumpsterSize
    volume: str
    price: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DumpsterTypeCreate(BaseModel):
    price: float

class RentalNote(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_id: str
    client_name: str
    client_address: str
    dumpster_code: str
    dumpster_size: DumpsterSize
    rental_date: datetime
    description: Optional[str] = ""
    status: RentalStatus = RentalStatus.ACTIVE
    is_paid: bool = False
    price: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RentalNoteCreate(BaseModel):
    client_id: str
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
    client_id: str
    rental_note_id: str
    amount: float
    received_date: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ReceivableCreate(BaseModel):
    client_id: str
    rental_note_id: str
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
async def update_dumpster_price(size: str, price_data: DumpsterTypeCreate):
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
    # Get client data
    client = await db.clients.find_one({"id": rental_data.client_id})
    if not client:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    
    # Create rental note with client data
    rental_dict = rental_data.dict()
    rental_dict["client_name"] = client["name"]
    rental_dict["client_address"] = client["address"]
    
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
    result = await db.rental_notes.update_one(
        {"id": note_id},
        {"$set": {"is_paid": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Nota não encontrada")
    return {"message": "Caçamba marcada como paga"}

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