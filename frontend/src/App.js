import React, { useState, useEffect } from 'react';
import './App.css';
import axios from 'axios';
import { Truck, Users, FileText, DollarSign, Settings, Plus, Search, Calendar, MapPin, Package } from 'lucide-react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import { Label } from './components/ui/label';
import { Textarea } from './components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [clients, setClients] = useState([]);
  const [dumpsterTypes, setDumpsterTypes] = useState([]);
  const [rentalNotes, setRentalNotes] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Dialog states
  const [clientDialog, setClientDialog] = useState(false);
  const [rentalDialog, setRentalDialog] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [priceDialog, setPriceDialog] = useState(false);
  const [clientStatsDialog, setClientStatsDialog] = useState(false);
  const [selectedClientStats, setSelectedClientStats] = useState(null);

  // Form states
  const [newClient, setNewClient] = useState({ name: '', address: '' });
  const [newRental, setNewRental] = useState({
    client_id: '',
    dumpster_code: '',
    dumpster_size: '',
    rental_date: '',
    description: '',
    price: 0
  });
  const [newPayment, setNewPayment] = useState({
    account_name: '',
    amount: 0,
    due_date: '',
    description: ''
  });

  // Fetch data functions
  const fetchClients = async () => {
    try {
      const response = await axios.get(`${API}/clients`);
      setClients(response.data);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
    }
  };

  const fetchDumpsterTypes = async () => {
    try {
      const response = await axios.get(`${API}/dumpster-types`);
      setDumpsterTypes(response.data);
    } catch (error) {
      console.error('Erro ao buscar tipos de caçamba:', error);
    }
  };

  const fetchRentalNotes = async () => {
    try {
      const response = await axios.get(`${API}/rental-notes/with-status`);
      setRentalNotes(response.data);
    } catch (error) {
      console.error('Erro ao buscar notas de locação:', error);
    }
  };

  const fetchPayments = async () => {
    try {
      const response = await axios.get(`${API}/payments`);
      setPayments(response.data);
    } catch (error) {
      console.error('Erro ao buscar pagamentos:', error);
    }
  };

  useEffect(() => {
    fetchClients();
    fetchDumpsterTypes();
    fetchRentalNotes();
    fetchPayments();
  }, []);

  // Create functions
  const createClient = async () => {
    try {
      setLoading(true);
      await axios.post(`${API}/clients`, newClient);
      setNewClient({ name: '', address: '' });
      setClientDialog(false);
      fetchClients();
    } catch (error) {
      console.error('Erro ao criar cliente:', error);
    } finally {
      setLoading(false);
    }
  };

  const createRental = async () => {
    try {
      setLoading(true);
      const selectedDumpster = dumpsterTypes.find(dt => dt.size === newRental.dumpster_size);
      const rentalData = {
        ...newRental,
        price: selectedDumpster?.price || newRental.price,
        rental_date: new Date(newRental.rental_date).toISOString()
      };
      await axios.post(`${API}/rental-notes`, rentalData);
      setNewRental({
        client_id: '',
        dumpster_code: '',
        dumpster_size: '',
        rental_date: '',
        description: '',
        price: 0
      });
      setRentalDialog(false);
      fetchRentalNotes();
    } catch (error) {
      console.error('Erro ao criar nota de locação:', error);
    } finally {
      setLoading(false);
    }
  };

  const createPayment = async () => {
    try {
      setLoading(true);
      const paymentData = {
        ...newPayment,
        due_date: new Date(newPayment.due_date).toISOString()
      };
      await axios.post(`${API}/payments`, paymentData);
      setNewPayment({
        account_name: '',
        amount: 0,
        due_date: '',
        description: ''
      });
      setPaymentDialog(false);
      fetchPayments();
    } catch (error) {
      console.error('Erro ao criar pagamento:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRetrieved = async (noteId) => {
    try {
      await axios.put(`${API}/rental-notes/${noteId}/retrieve`);
      fetchRentalNotes();
    } catch (error) {
      console.error('Erro ao marcar como retirada:', error);
    }
  };

  const markAsPaid = async (noteId) => {
    try {
      await axios.put(`${API}/rental-notes/${noteId}/pay`);
      fetchRentalNotes();
    } catch (error) {
      console.error('Erro ao marcar como paga:', error);
    }
  };

  const getClientStats = async (clientId) => {
    try {
      const response = await axios.get(`${API}/clients/${clientId}/stats`);
      setSelectedClientStats(response.data);
      setClientStatsDialog(true);
    } catch (error) {
      console.error('Erro ao buscar estatísticas do cliente:', error);
    }
  };

  const getStatusColor = (colorStatus) => {
    switch (colorStatus) {
      case 'green': return 'bg-green-100 border-green-300 text-green-800';
      case 'yellow': return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'red': return 'bg-red-100 border-red-300 text-red-800';
      case 'purple': return 'bg-purple-100 border-purple-300 text-purple-800';
      default: return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const getStatusText = (colorStatus, status) => {
    if (status === 'retrieved') return 'Retirada';
    switch (colorStatus) {
      case 'green': return 'No Prazo';
      case 'yellow': return 'Vencida';
      case 'purple': return 'Abandonada';
      default: return 'Status';
    }
  };

  const filteredRentals = rentalNotes.filter(rental => 
    rental.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rental.client_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rental.dumpster_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.address.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-lg border-b-2 border-orange-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-orange-500 to-red-500 p-3 rounded-lg">
                <Truck className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Disk Entulho Marchioretto</h1>
                <p className="text-sm text-gray-600">Sistema de Gestão de Caçambas</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-fit lg:flex lg:space-x-2">
            <TabsTrigger value="dashboard" className="flex items-center space-x-2">
              <Package className="h-4 w-4" />
              <span>Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="clients" className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>Clientes</span>
            </TabsTrigger>
            <TabsTrigger value="rentals" className="flex items-center space-x-2">
              <FileText className="h-4 w-4" />
              <span>Notas</span>
            </TabsTrigger>
            <TabsTrigger value="financial" className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4" />
              <span>Financeiro</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>Configurações</span>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium opacity-90">Total Clientes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{clients.length}</div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium opacity-90">Caçambas Ativas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{rentalNotes.filter(r => r.status === 'active').length}</div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium opacity-90">Caçambas Retiradas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{rentalNotes.filter(r => r.status === 'retrieved').length}</div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium opacity-90">Total Pagamentos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{payments.length}</div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Caçambas Recentes</CardTitle>
                <CardDescription>Últimas locações realizadas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {rentalNotes.slice(0, 5).map((rental) => (
                    <div key={rental.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{rental.client_name}</p>
                        <p className="text-sm text-gray-600">{rental.dumpster_code} - {rental.dumpster_size}</p>
                      </div>
                      <Badge className={getStatusColor(rental.color_status)}>
                        {getStatusText(rental.color_status, rental.status)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Clients Tab */}
          <TabsContent value="clients" className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Pesquisar clientes..."
                  className="pl-10 w-80"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <Dialog open={clientDialog} onOpenChange={setClientDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Cliente
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Novo Cliente</DialogTitle>
                    <DialogDescription>Preencha os dados do cliente abaixo.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="client-name">Nome</Label>
                      <Input
                        id="client-name"
                        value={newClient.name}
                        onChange={(e) => setNewClient({...newClient, name: e.target.value})}
                        placeholder="Nome do cliente"
                      />
                    </div>
                    <div>
                      <Label htmlFor="client-address">Endereço</Label>
                      <Input
                        id="client-address"
                        value={newClient.address}
                        onChange={(e) => setNewClient({...newClient, address: e.target.value})}
                        placeholder="Endereço do cliente"
                      />
                    </div>
                    <Button onClick={createClient} disabled={loading} className="w-full">
                      {loading ? 'Salvando...' : 'Salvar Cliente'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredClients.map((client) => (
                <Card key={client.id} className="hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => getClientStats(client.id)}>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Users className="h-5 w-5 text-blue-600" />
                      <span>{client.name}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-start space-x-2">
                      <MapPin className="h-4 w-4 text-gray-400 mt-1" />
                      <p className="text-sm text-gray-600">{client.address}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Rentals Tab */}
          <TabsContent value="rentals" className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Pesquisar por cliente, endereço ou código..."
                  className="pl-10 w-80"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <Dialog open={rentalDialog} onOpenChange={setRentalDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-green-600 hover:bg-green-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Locação
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Nova Locação</DialogTitle>
                    <DialogDescription>Preencha os dados da locação abaixo.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="rental-client">Cliente</Label>
                      <Select value={newRental.client_id} onValueChange={(value) => setNewRental({...newRental, client_id: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name} - {client.address}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="dumpster-code">Código da Caçamba</Label>
                      <Input
                        id="dumpster-code"
                        value={newRental.dumpster_code}
                        onChange={(e) => setNewRental({...newRental, dumpster_code: e.target.value})}
                        placeholder="Ex: CAC001"
                      />
                    </div>
                    <div>
                      <Label htmlFor="dumpster-size">Tamanho da Caçamba</Label>
                      <Select value={newRental.dumpster_size} onValueChange={(value) => setNewRental({...newRental, dumpster_size: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tamanho" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pequena">Pequena (1m³)</SelectItem>
                          <SelectItem value="Média">Média (2,5m³)</SelectItem>
                          <SelectItem value="Grande">Grande (5m³)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="rental-date">Data de Locação</Label>
                      <Input
                        id="rental-date"
                        type="datetime-local"
                        value={newRental.rental_date}
                        onChange={(e) => setNewRental({...newRental, rental_date: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">Descrição</Label>
                      <Textarea
                        id="description"
                        value={newRental.description}
                        onChange={(e) => setNewRental({...newRental, description: e.target.value})}
                        placeholder="Observações sobre a locação"
                      />
                    </div>
                    <Button onClick={createRental} disabled={loading} className="w-full">
                      {loading ? 'Salvando...' : 'Salvar Locação'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredRentals.map((rental) => (
                <Card key={rental.id} className={`border-2 ${getStatusColor(rental.color_status)} transition-all hover:shadow-lg`}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Caçamba {rental.dumpster_code}</span>
                      <Badge className={getStatusColor(rental.color_status)}>
                        {getStatusText(rental.color_status, rental.status)}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="font-medium">{rental.client_name}</p>
                      <p className="text-sm text-gray-600 flex items-center">
                        <MapPin className="h-4 w-4 mr-1" />
                        {rental.client_address}
                      </p>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span>Tamanho: {rental.dumpster_size}</span>
                      <span className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        {new Date(rental.rental_date).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="font-medium">R$ {rental.price.toFixed(2)}</span>
                      {rental.is_paid && <Badge variant="outline" className="bg-green-50 text-green-700">Pago</Badge>}
                    </div>
                    {rental.description && (
                      <p className="text-sm text-gray-600 italic">{rental.description}</p>
                    )}
                    <div className="flex space-x-2 pt-2">
                      {rental.status !== 'retrieved' && (
                        <Button size="sm" variant="outline" onClick={() => markAsRetrieved(rental.id)}>
                          Marcar como Retirada
                        </Button>
                      )}
                      {!rental.is_paid && (
                        <Button size="sm" variant="outline" onClick={() => markAsPaid(rental.id)}>
                          Marcar como Paga
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Financial Tab */}
          <TabsContent value="financial" className="space-y-6">
            <div className="flex justify-end">
              <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-purple-600 hover:bg-purple-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Pagamento
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Registrar Pagamento</DialogTitle>
                    <DialogDescription>Adicione um novo pagamento ao sistema.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="account-name">Nome da Conta</Label>
                      <Input
                        id="account-name"
                        value={newPayment.account_name}
                        onChange={(e) => setNewPayment({...newPayment, account_name: e.target.value})}
                        placeholder="Ex: Fornecedor XYZ"
                      />
                    </div>
                    <div>
                      <Label htmlFor="amount">Valor</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        value={newPayment.amount}
                        onChange={(e) => setNewPayment({...newPayment, amount: parseFloat(e.target.value)})}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="due-date">Data de Vencimento</Label>
                      <Input
                        id="due-date"
                        type="date"
                        value={newPayment.due_date}
                        onChange={(e) => setNewPayment({...newPayment, due_date: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="payment-description">Descrição</Label>
                      <Textarea
                        id="payment-description"
                        value={newPayment.description}
                        onChange={(e) => setNewPayment({...newPayment, description: e.target.value})}
                        placeholder="Descrição do pagamento"
                      />
                    </div>
                    <Button onClick={createPayment} disabled={loading} className="w-full">
                      {loading ? 'Salvando...' : 'Salvar Pagamento'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Pagamentos Registrados</CardTitle>
                <CardDescription>Lista de todos os pagamentos do sistema</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {payments.map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{payment.account_name}</p>
                        <p className="text-sm text-gray-600">{payment.description}</p>
                        <p className="text-xs text-gray-500">
                          Vencimento: {new Date(payment.due_date).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-600">R$ {payment.amount.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Configuração de Preços</CardTitle>
                <CardDescription>Gerencie os preços das caçambas por tamanho</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {dumpsterTypes.map((type) => (
                    <Card key={type.id} className="border-2">
                      <CardHeader>
                        <CardTitle className="text-lg">{type.size}</CardTitle>
                        <CardDescription>{type.volume}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div>
                            <Label>Preço Atual</Label>
                            <p className="text-2xl font-bold text-green-600">R$ {type.price.toFixed(2)}</p>
                          </div>
                          <Button variant="outline" size="sm" className="w-full">
                            Alterar Preço
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Client Stats Dialog */}
      <Dialog open={clientStatsDialog} onOpenChange={setClientStatsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Estatísticas do Cliente</DialogTitle>
          </DialogHeader>
          {selectedClientStats && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-blue-600">{selectedClientStats.total_dumpsters}</p>
                  <p className="text-sm text-gray-600">Total de Caçambas</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{selectedClientStats.paid_dumpsters}</p>
                  <p className="text-sm text-gray-600">Caçambas Pagas</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-600">{selectedClientStats.open_dumpsters}</p>
                  <p className="text-sm text-gray-600">Em Aberto</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default App;