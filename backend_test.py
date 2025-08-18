import requests
import sys
import json
from datetime import datetime, timedelta
import uuid

class DiskEntulhoAPITester:
    def __init__(self, base_url="https://marchioretto-app.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.created_client_id = None
        self.created_rental_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, list):
                        print(f"   Response: List with {len(response_data)} items")
                    else:
                        print(f"   Response keys: {list(response_data.keys()) if isinstance(response_data, dict) else 'Not a dict'}")
                except:
                    print(f"   Response: {response.text[:100]}...")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")

            return success, response.json() if response.text else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_dumpster_types(self):
        """Test GET /api/dumpster-types - should return 3 types"""
        success, response = self.run_test(
            "Get Dumpster Types",
            "GET",
            "dumpster-types",
            200
        )
        
        if success and isinstance(response, list):
            expected_sizes = ["Pequena", "Média", "Grande"]
            found_sizes = [dt.get('size') for dt in response]
            
            if len(response) == 3:
                print(f"   ✅ Found 3 dumpster types as expected")
            else:
                print(f"   ⚠️  Expected 3 types, found {len(response)}")
                
            for size in expected_sizes:
                if size in found_sizes:
                    print(f"   ✅ Found {size} type")
                else:
                    print(f"   ❌ Missing {size} type")
                    
            # Print details of each type
            for dt in response:
                print(f"   - {dt.get('size')}: {dt.get('volume')} - R$ {dt.get('price')}")
        
        return success

    def test_create_client(self):
        """Test POST /api/clients"""
        test_client = {
            "name": f"Cliente Teste {datetime.now().strftime('%H%M%S')}",
            "address": "Rua Teste, 123 - Centro"
        }
        
        success, response = self.run_test(
            "Create Client",
            "POST",
            "clients",
            200,
            data=test_client
        )
        
        if success and 'id' in response:
            self.created_client_id = response['id']
            print(f"   ✅ Client created with ID: {self.created_client_id}")
        
        return success

    def test_get_clients(self):
        """Test GET /api/clients"""
        success, response = self.run_test(
            "Get Clients",
            "GET",
            "clients",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   ✅ Found {len(response)} clients")
            if self.created_client_id:
                client_found = any(c.get('id') == self.created_client_id for c in response)
                if client_found:
                    print(f"   ✅ Created client found in list")
                else:
                    print(f"   ❌ Created client not found in list")
        
        return success

    def test_create_rental_note(self):
        """Test POST /api/rental-notes"""
        if not self.created_client_id:
            print("   ❌ Cannot test rental creation - no client ID available")
            return False
            
        # Use current time for rental date
        rental_date = datetime.now().isoformat()
        
        test_rental = {
            "client_id": self.created_client_id,
            "dumpster_code": f"CAC{datetime.now().strftime('%H%M%S')}",
            "dumpster_size": "Média",
            "rental_date": rental_date,
            "description": "Teste de locação via API",
            "price": 250.0
        }
        
        success, response = self.run_test(
            "Create Rental Note",
            "POST",
            "rental-notes",
            200,
            data=test_rental
        )
        
        if success and 'id' in response:
            self.created_rental_id = response['id']
            print(f"   ✅ Rental note created with ID: {self.created_rental_id}")
            print(f"   ✅ Status: {response.get('status')}")
            print(f"   ✅ Is Paid: {response.get('is_paid')}")
        
        return success

    def test_get_rental_notes_with_status(self):
        """Test GET /api/rental-notes/with-status"""
        success, response = self.run_test(
            "Get Rental Notes with Status",
            "GET",
            "rental-notes/with-status",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   ✅ Found {len(response)} rental notes")
            
            # Check if our created rental is there and has color status
            if self.created_rental_id:
                rental_found = None
                for rental in response:
                    if rental.get('id') == self.created_rental_id:
                        rental_found = rental
                        break
                
                if rental_found:
                    print(f"   ✅ Created rental found in list")
                    print(f"   ✅ Color status: {rental_found.get('color_status')}")
                    print(f"   ✅ Status: {rental_found.get('status')}")
                else:
                    print(f"   ❌ Created rental not found in list")
            
            # Check color status distribution
            color_counts = {}
            for rental in response:
                color = rental.get('color_status', 'unknown')
                color_counts[color] = color_counts.get(color, 0) + 1
            
            print(f"   Color status distribution: {color_counts}")
        
        return success

    def test_mark_as_retrieved(self):
        """Test PUT /api/rental-notes/{id}/retrieve"""
        if not self.created_rental_id:
            print("   ❌ Cannot test mark as retrieved - no rental ID available")
            return False
            
        success, response = self.run_test(
            "Mark Rental as Retrieved",
            "PUT",
            f"rental-notes/{self.created_rental_id}/retrieve",
            200
        )
        
        if success:
            print(f"   ✅ Rental marked as retrieved")
        
        return success

    def test_mark_as_paid(self):
        """Test PUT /api/rental-notes/{id}/pay"""
        if not self.created_rental_id:
            print("   ❌ Cannot test mark as paid - no rental ID available")
            return False
            
        success, response = self.run_test(
            "Mark Rental as Paid",
            "PUT",
            f"rental-notes/{self.created_rental_id}/pay",
            200
        )
        
        if success:
            print(f"   ✅ Rental marked as paid")
        
        return success

    def test_client_stats(self):
        """Test GET /api/clients/{id}/stats"""
        if not self.created_client_id:
            print("   ❌ Cannot test client stats - no client ID available")
            return False
            
        success, response = self.run_test(
            "Get Client Stats",
            "GET",
            f"clients/{self.created_client_id}/stats",
            200
        )
        
        if success:
            expected_keys = ['total_dumpsters', 'paid_dumpsters', 'open_dumpsters']
            for key in expected_keys:
                if key in response:
                    print(f"   ✅ {key}: {response[key]}")
                else:
                    print(f"   ❌ Missing key: {key}")
        
        return success

    def test_verify_status_changes(self):
        """Verify that status changes are reflected in the rental notes"""
        success, response = self.run_test(
            "Verify Status Changes",
            "GET",
            "rental-notes/with-status",
            200
        )
        
        if success and self.created_rental_id:
            rental_found = None
            for rental in response:
                if rental.get('id') == self.created_rental_id:
                    rental_found = rental
                    break
            
            if rental_found:
                print(f"   ✅ Final rental status: {rental_found.get('status')}")
                print(f"   ✅ Final color status: {rental_found.get('color_status')}")
                print(f"   ✅ Final is_paid: {rental_found.get('is_paid')}")
                
                # Should be red since we marked it as retrieved
                if rental_found.get('color_status') == 'red':
                    print(f"   ✅ Color status correctly shows 'red' for retrieved rental")
                else:
                    print(f"   ⚠️  Expected color status 'red', got '{rental_found.get('color_status')}'")
                    
                if rental_found.get('is_paid') == True:
                    print(f"   ✅ Rental correctly marked as paid")
                else:
                    print(f"   ⚠️  Expected is_paid to be True")
        
        return success

    def test_update_dumpster_price(self):
        """Test PUT /api/dumpster-types/{size} - Price configuration feature"""
        # Test updating price for "Pequena" dumpster
        new_price = 175.0
        success, response = self.run_test(
            "Update Dumpster Price",
            "PUT",
            "dumpster-types/Pequena",
            200,
            data={"price": new_price}
        )
        
        if success:
            print(f"   ✅ Price updated successfully")
            
            # Verify the price was actually updated
            verify_success, verify_response = self.run_test(
                "Verify Price Update",
                "GET",
                "dumpster-types",
                200
            )
            
            if verify_success:
                pequena_type = next((dt for dt in verify_response if dt.get('size') == 'Pequena'), None)
                if pequena_type and pequena_type.get('price') == new_price:
                    print(f"   ✅ Price verification successful: R$ {pequena_type.get('price')}")
                else:
                    print(f"   ❌ Price verification failed")
        
        return success

    def test_rental_filters(self):
        """Test rental note filtering endpoints"""
        # Test active rentals
        success1, response1 = self.run_test(
            "Get Active Rentals",
            "GET",
            "rental-notes/active",
            200
        )
        
        # Test retrieved rentals  
        success2, response2 = self.run_test(
            "Get Retrieved Rentals",
            "GET",
            "rental-notes/retrieved",
            200
        )
        
        # Test overdue rentals
        success3, response3 = self.run_test(
            "Get Overdue Rentals",
            "GET",
            "rental-notes/overdue",
            200
        )
        
        if success1 and success2 and success3:
            print(f"   ✅ Active rentals: {len(response1)} items")
            print(f"   ✅ Retrieved rentals: {len(response2)} items")
            print(f"   ✅ Overdue rentals: {len(response3)} items")
            
            # Verify our test rental is in retrieved list
            if self.created_rental_id:
                found_in_retrieved = any(r.get('id') == self.created_rental_id for r in response2)
                if found_in_retrieved:
                    print(f"   ✅ Test rental found in retrieved list")
                else:
                    print(f"   ❌ Test rental not found in retrieved list")
        
        return success1 and success2 and success3

    def test_dashboard_stats(self):
        """Test GET /api/dashboard/stats - Dashboard functionality"""
        success, response = self.run_test(
            "Get Dashboard Stats",
            "GET",
            "dashboard/stats",
            200
        )
        
        if success:
            expected_keys = ['total_clients', 'active_dumpsters', 'retrieved_dumpsters', 'overdue_dumpsters', 'total_payments']
            for key in expected_keys:
                if key in response:
                    print(f"   ✅ {key}: {response[key]}")
                else:
                    print(f"   ❌ Missing key: {key}")
        
        return success

    def test_financial_summary(self):
        """Test GET /api/financial/monthly-summary - Financial functionality"""
        success, response = self.run_test(
            "Get Monthly Financial Summary",
            "GET",
            "financial/monthly-summary",
            200
        )
        
        if success:
            expected_keys = ['month', 'total_received', 'total_paid', 'net_income', 'receivables', 'payments']
            for key in expected_keys:
                if key in response:
                    if key in ['receivables', 'payments']:
                        print(f"   ✅ {key}: {len(response[key])} items")
                    else:
                        print(f"   ✅ {key}: {response[key]}")
                else:
                    print(f"   ❌ Missing key: {key}")
                    
            # Check if our payment created a receivable
            receivables = response.get('receivables', [])
            if self.created_rental_id:
                found_receivable = any(r.get('rental_note_id') == self.created_rental_id for r in receivables)
                if found_receivable:
                    print(f"   ✅ Automatic receivable created for paid rental")
                else:
                    print(f"   ⚠️  No automatic receivable found for paid rental")
        
        return success

    def test_unregistered_client_rental(self):
        """Test creating rental for unregistered client"""
        rental_date = datetime.now().isoformat()
        
        test_rental = {
            "client_name": "Cliente Não Cadastrado Teste",
            "client_address": "Rua Temporária, 456",
            "client_phone": "(11) 98765-4321",
            "dumpster_code": f"TEMP{datetime.now().strftime('%H%M%S')}",
            "dumpster_size": "Grande",
            "rental_date": rental_date,
            "description": "Teste de cliente não cadastrado",
            "price": 350.0
        }
        
        success, response = self.run_test(
            "Create Rental for Unregistered Client",
            "POST",
            "rental-notes",
            200,
            data=test_rental
        )
        
        if success and 'id' in response:
            print(f"   ✅ Unregistered client rental created with ID: {response['id']}")
            print(f"   ✅ Client name: {response.get('client_name')}")
            print(f"   ✅ Client address: {response.get('client_address')}")
            print(f"   ✅ Client phone: {response.get('client_phone')}")
            print(f"   ✅ Client ID: {response.get('client_id')} (should be None)")
        
        return success

def main():
    print("🚀 Starting Disk Entulho Marchioretto API Tests")
    print("=" * 60)
    
    tester = DiskEntulhoAPITester()
    
    # Test sequence following the workflow
    tests = [
        ("Dumpster Types", tester.test_dumpster_types),
        ("Create Client", tester.test_create_client),
        ("Get Clients", tester.test_get_clients),
        ("Create Rental Note", tester.test_create_rental_note),
        ("Get Rental Notes with Status", tester.test_get_rental_notes_with_status),
        ("Mark as Retrieved", tester.test_mark_as_retrieved),
        ("Mark as Paid", tester.test_mark_as_paid),
        ("Get Client Stats", tester.test_client_stats),
        ("Verify Status Changes", tester.test_verify_status_changes),
    ]
    
    for test_name, test_func in tests:
        print(f"\n{'='*20} {test_name} {'='*20}")
        try:
            test_func()
        except Exception as e:
            print(f"❌ Test {test_name} failed with exception: {str(e)}")
    
    # Print final results
    print(f"\n{'='*60}")
    print(f"📊 FINAL RESULTS")
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    print(f"Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%" if tester.tests_run > 0 else "No tests run")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed! Backend APIs are working correctly.")
        return 0
    else:
        print("⚠️  Some tests failed. Check the output above for details.")
        return 1

if __name__ == "__main__":
    sys.exit(main())