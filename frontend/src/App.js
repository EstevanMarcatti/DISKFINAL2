import React, { useState, useEffect } from 'react';
import './App.css';
import './leaflet.css';
import axios from 'axios';
import { Truck, Users, FileText, DollarSign, Settings, Plus, Search, Calendar, MapPin, Package, Edit2, Trash2, Phone, Mail, Clock, Download, CreditCard, Map } from 'lucide-react';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Badge } from './components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import { Label } from './components/ui/label';
import { Textarea } from './components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Switch } from './components/ui/switch';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// Fix for leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMzYiIHZpZXdCb3g9IjAgMCAyNCAzNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDM2TDEyIDEyTDI0IDEyTDEyIDM2WiIgZmlsbD0iIzMzNzNkYyIvPgo8Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMiIgZmlsbD0iIzMzNzNkYyIvPgo8Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSI4IiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K',
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMzYiIHZpZXdCb3g9IjAgMCAyNCAzNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDM2TDEyIDEyTDI0IDEyTDEyIDM2WiIgZmlsbD0iIzMzNzNkYyIvPgo8Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMiIgZmlsbD0iIzMzNzNkYyIvPgo8Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSI4IiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K',
  shadowUrl: ''
});

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [clients, setClients] = useState([]);
  const [dumpsterTypes, setDumpsterTypes] = useState([]);
  const [rentalNotes, setRentalNotes] = useState([]);
  const [activeRentals, setActiveRentals] = useState([]);
  const [retrievedRentals, setRetrievedRentals] = useState([]);
  const [overdueRentals, setOverdueRentals] = useState([]);
  const [expiredRentals, setExpiredRentals] = useState([]);
  const [payments, setPayments] = useState([]);
  const [receivables, setReceivables] = useState([]);
  const [monthlyFinancial, setMonthlyFinancial] = useState(null);
  const [dashboardStats, setDashboardStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingClient, setEditingClient] = useState(null);
  
  // Map states
  const [mapData, setMapData] = useState([]);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [addingMarker, setAddingMarker] = useState(false);
  const [newMarkerPos, setNewMarkerPos] = useState(null);

  // Dialog states
  const [clientDialog, setClientDialog] = useState(false);
  const [rentalDialog, setRentalDialog] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [priceDialog, setPriceDialog] = useState(false);
  const [clientStatsDialog, setClientStatsDialog] = useState(false);
  const [financialDialog, setFinancialDialog] = useState(false);
  const [editClientDialog, setEditClientDialog] = useState(false);
  const [reportDialog, setReportDialog] = useState(false);
  const [selectedClientStats, setSelectedClientStats] = useState(null);
  const [selectedDumpsterType, setSelectedDumpsterType] = useState(null);

  // Form states
  const [newClient, setNewClient] = useState({ 
    name: '', 
    address: '', 
    phone: '', 
    email: '', 
    cpf_cnpj: '',
    additional_address: '', 
    notes: '' 
  });
  const [newRental, setNewRental] = useState({
    client_id: '',
    client_name: '',
    client_address: '',
    client_phone: '',
    dumpster_code: '',
    dumpster_size: '',
    rental_date: '',
    description: '',
    price: 0,
    use_unregistered_client: false
  });
  const [newPayment, setNewPayment] = useState({
    account_name: '',
    amount: 0,
    due_date: '',
    description: ''
  });
  const [newPrice, setNewPrice] = useState(0);
  const [financialDateRange, setFinancialDateRange] = useState({
    start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  });
  const [reportDates, setReportDates] = useState({
    start_date: '',
    end_date: ''
  });

  // Rental view states
  const [rentalViewMode, setRentalViewMode] = useState('all'); // 'all', 'active', 'retrieved'

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
      
      // Also fetch separated lists
      const activeResponse = await axios.get(`${API}/rental-notes/active`);
      setActiveRentals(activeResponse.data);
      
      const retrievedResponse = await axios.get(`${API}/rental-notes/retrieved`);
      setRetrievedRentals(retrievedResponse.data);
      
      const overdueResponse = await axios.get(`${API}/rental-notes/overdue`);
      setOverdueRentals(overdueResponse.data);
      
      const expiredResponse = await axios.get(`${API}/rental-notes/expired`);
      setExpiredRentals(expiredResponse.data);
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

  const fetchReceivables = async () => {
    try {
      const response = await axios.get(`${API}/receivables`);
      setReceivables(response.data);
    } catch (error) {
      console.error('Erro ao buscar recebimentos:', error);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/stats`);
      setDashboardStats(response.data);
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    }
  };

  const fetchMonthlyFinancial = async (startDate = null, endDate = null) => {
    try {
      let url = `${API}/financial/monthly-summary`;
      if (startDate && endDate) {
        // Use the detailed report endpoint for custom date ranges
        const response = await axios.post(`${API}/reports/detailed`, {
          start_date: new Date(startDate).toISOString(),
          end_date: new Date(endDate).toISOString()
        });
        
        const reportData = response.data;
        setMonthlyFinancial({
          month: `${new Date(startDate).toLocaleDateString('pt-BR')} a ${new Date(endDate).toLocaleDateString('pt-BR')}`,
          total_received: reportData.totals.total_receivable_amount || 0,
          total_paid: reportData.totals.total_payment_amount || 0,
          net_income: reportData.totals.net_income || 0,
          receivables: reportData.daily_data.flatMap(day => day.receivable_details || []),
          payments: reportData.daily_data.flatMap(day => day.payment_details || [])
        });
      } else {
        const response = await axios.get(url);
        setMonthlyFinancial(response.data);
      }
    } catch (error) {
      console.error('Erro ao buscar resumo financeiro:', error);
    }
  };

  const updateFinancialSummary = async () => {
    await fetchMonthlyFinancial(financialDateRange.start_date, financialDateRange.end_date);
  };

  useEffect(() => {
    fetchClients();
    fetchDumpsterTypes();
    fetchRentalNotes();
    fetchPayments();
    fetchReceivables();
    fetchDashboardStats();
    fetchMonthlyFinancial();
  }, []);

  // Create functions
  const createClient = async () => {
    if (!newClient.name || !newClient.address) {
      alert('Nome e endereço são obrigatórios');
      return;
    }
    
    try {
      setLoading(true);
      await axios.post(`${API}/clients`, newClient);
      setNewClient({ 
        name: '', 
        address: '', 
        phone: '', 
        email: '', 
        cpf_cnpj: '',
        additional_address: '', 
        notes: '' 
      });
      setClientDialog(false);
      fetchClients();
      fetchDashboardStats();
    } catch (error) {
      console.error('Erro ao criar cliente:', error);
      alert('Erro ao criar cliente');
    } finally {
      setLoading(false);
    }
  };

  const updateClient = async () => {
    if (!editingClient.name || !editingClient.address) {
      alert('Nome e endereço são obrigatórios');
      return;
    }
    
    try {
      setLoading(true);
      await axios.put(`${API}/clients/${editingClient.id}`, editingClient);
      setEditClientDialog(false);
      setEditingClient(null);
      fetchClients();
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error);
      alert('Erro ao atualizar cliente');
    } finally {
      setLoading(false);
    }
  };

  const deleteClient = async (clientId) => {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) {
      return;
    }
    
    try {
      await axios.delete(`${API}/clients/${clientId}`);
      fetchClients();
      fetchDashboardStats();
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
      alert('Erro ao excluir cliente');
    }
  };

  const deleteRentalNote = async (noteId) => {
    if (!confirm('Tem certeza que deseja excluir esta nota de locação?')) {
      return;
    }
    
    try {
      await axios.delete(`${API}/rental-notes/${noteId}`);
      fetchRentalNotes();
      fetchDashboardStats();
      alert('Nota excluída com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir nota:', error);
      alert('Erro ao excluir nota');
    }
  };

  const createRental = async () => {
    try {
      setLoading(true);
      const selectedDumpster = dumpsterTypes.find(dt => dt.size === newRental.dumpster_size);
      let rentalData;
      
      if (newRental.use_unregistered_client) {
        if (!newRental.client_name || !newRental.client_address) {
          alert('Nome e endereço do cliente são obrigatórios');
          return;
        }
        rentalData = {
          client_name: newRental.client_name,
          client_address: newRental.client_address,
          client_phone: newRental.client_phone,
          dumpster_code: newRental.dumpster_code,
          dumpster_size: newRental.dumpster_size,
          rental_date: new Date(newRental.rental_date).toISOString(),
          description: newRental.description,
          price: selectedDumpster?.price || newRental.price
        };
      } else {
        if (!newRental.client_id) {
          alert('Selecione um cliente');
          return;
        }
        rentalData = {
          client_id: newRental.client_id,
          dumpster_code: newRental.dumpster_code,
          dumpster_size: newRental.dumpster_size,
          rental_date: new Date(newRental.rental_date).toISOString(),
          description: newRental.description,
          price: selectedDumpster?.price || newRental.price
        };
      }
      
      await axios.post(`${API}/rental-notes`, rentalData);
      setNewRental({
        client_id: '',
        client_name: '',
        client_address: '',
        client_phone: '',
        dumpster_code: '',
        dumpster_size: '',
        rental_date: '',
        description: '',
        price: 0,
        use_unregistered_client: false
      });
      setRentalDialog(false);
      fetchRentalNotes();
      fetchDashboardStats();
    } catch (error) {
      console.error('Erro ao criar nota de locação:', error);
      alert('Erro ao criar locação');
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
      fetchMonthlyFinancial();
    } catch (error) {
      console.error('Erro ao criar pagamento:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateDumpsterPrice = async () => {
    try {
      setLoading(true);
      await axios.put(`${API}/dumpster-types/${selectedDumpsterType.size}`, {
        price: newPrice
      });
      setPriceDialog(false);
      setSelectedDumpsterType(null);
      setNewPrice(0);
      fetchDumpsterTypes();
      alert('Preço atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar preço:', error);
      alert('Erro ao atualizar preço');
    } finally {
      setLoading(false);
    }
  };

  const markAsRetrieved = async (noteId) => {
    try {
      await axios.put(`${API}/rental-notes/${noteId}/retrieve`);
      fetchRentalNotes();
      fetchDashboardStats();
    } catch (error) {
      console.error('Erro ao marcar como retirada:', error);
    }
  };

  const markAsPaid = async (noteId) => {
    try {
      await axios.put(`${API}/rental-notes/${noteId}/pay`);
      fetchRentalNotes();
      fetchReceivables();
      fetchMonthlyFinancial();
      fetchDashboardStats();
      alert('Caçamba marcada como paga e recebimento registrado automaticamente!');
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

  const generateDetailedReport = async () => {
    if (!reportDates.start_date || !reportDates.end_date) {
      alert('Selecione as datas de início e fim do relatório');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(`${API}/reports/detailed`, {
        start_date: new Date(reportDates.start_date).toISOString(),
        end_date: new Date(reportDates.end_date).toISOString()
      });

      const reportData = response.data;
      
      // Create PDF with better error handling
      try {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        
        // Header
        doc.setFontSize(20);
        doc.setTextColor(40, 40, 40);
        doc.text('Disk Entulho Marchioretto', pageWidth / 2, 20, { align: 'center' });
        
        doc.setFontSize(16);
        doc.text('Extrato Detalhado', pageWidth / 2, 30, { align: 'center' });
        
        doc.setFontSize(12);
        doc.text(`Período: ${reportData.period.start_date} a ${reportData.period.end_date}`, pageWidth / 2, 40, { align: 'center' });
        
        let yPosition = 55;
        
        // Totals Summary
        doc.setFontSize(14);
        doc.setTextColor(0, 100, 0);
        doc.text('RESUMO GERAL', 14, yPosition);
        yPosition += 10;
        
        doc.setFontSize(10);
        doc.setTextColor(40, 40, 40);
        doc.text(`Total de Caçambas Locadas: ${reportData.totals.total_rentals || 0}`, 14, yPosition);
        doc.text(`Valor Total das Locações: R$ ${(reportData.totals.total_rental_amount || 0).toFixed(2)}`, 14, yPosition + 8);
        doc.text(`Total Recebido: R$ ${(reportData.totals.total_receivable_amount || 0).toFixed(2)}`, 14, yPosition + 16);
        doc.text(`Total Pago: R$ ${(reportData.totals.total_payment_amount || 0).toFixed(2)}`, 14, yPosition + 24);
        doc.text(`Receita Líquida: R$ ${(reportData.totals.net_income || 0).toFixed(2)}`, 14, yPosition + 32);
        yPosition += 45;
        
        // Daily Details Table
        if (reportData.daily_data && reportData.daily_data.length > 0) {
          doc.setFontSize(14);
          doc.setTextColor(0, 0, 150);
          doc.text('DETALHES POR DIA', 14, yPosition);
          yPosition += 10;
          
          const tableData = reportData.daily_data.map(day => [
            day.formatted_date || 'N/A',
            (day.rentals || 0).toString(),
            `R$ ${(day.rental_amount || 0).toFixed(2)}`,
            (day.receivables || 0).toString(),
            `R$ ${(day.receivable_amount || 0).toFixed(2)}`,
            (day.payments || 0).toString(),
            `R$ ${(day.payment_amount || 0).toFixed(2)}`
          ]);
          
          doc.autoTable({
            head: [['Data', 'Locações', 'Valor Locações', 'Recebimentos', 'Valor Recebido', 'Pagamentos', 'Valor Pago']],
            body: tableData,
            startY: yPosition,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [100, 150, 200] }
          });
          
          // Chart simulation (text-based representation)
          const finalY = doc.lastAutoTable?.finalY ? doc.lastAutoTable.finalY + 20 : yPosition + 100;
          doc.setFontSize(14);
          doc.setTextColor(150, 0, 150);
          doc.text('RESUMO VISUAL', 14, finalY);
          
          doc.setFontSize(10);
          doc.setTextColor(40, 40, 40);
          doc.text('Evolução do Período:', 14, finalY + 15);
          
          // Simple text-based chart representation
          if (reportData.chart_data && reportData.chart_data.dates) {
            reportData.chart_data.dates.forEach((date, index) => {
              const rentals = reportData.chart_data.rentals[index] || 0;
              const receivables = reportData.chart_data.receivables[index] || 0;
              const payments = reportData.chart_data.payments[index] || 0;
              
              if (finalY + 25 + (index * 8) < 280) { // Check page bounds
                doc.text(`${date}: Locações: ${rentals} | Recebido: R$ ${receivables.toFixed(2)} | Pago: R$ ${payments.toFixed(2)}`, 
                        14, finalY + 25 + (index * 8));
              }
            });
          }
        } else {
          doc.text('Nenhum dado encontrado para o período selecionado.', 14, yPosition);
        }
        
        // Save PDF
        const fileName = `Extrato_${reportData.period.start_date.replace(/\//g, '-')}_a_${reportData.period.end_date.replace(/\//g, '-')}.pdf`;
        doc.save(fileName);
        
        setReportDialog(false);
        alert('Relatório PDF gerado com sucesso!');
        
      } catch (pdfError) {
        console.error('Erro ao gerar PDF:', pdfError);
        alert('Erro ao gerar o arquivo PDF. Dados obtidos mas falha na criação do arquivo.');
      }
      
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      alert('Erro ao obter dados do relatório: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
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

  const filteredRentals = () => {
    let rentalsToFilter = rentalNotes;
    
    if (rentalViewMode === 'active') {
      rentalsToFilter = activeRentals;
    } else if (rentalViewMode === 'retrieved') {
      rentalsToFilter = retrievedRentals;
    }
    
    return rentalsToFilter.filter(rental => 
      rental.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rental.client_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rental.dumpster_code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.phone && client.phone.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (client.cpf_cnpj && client.cpf_cnpj.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const openPriceDialog = (dumpsterType) => {
    setSelectedDumpsterType(dumpsterType);
    setNewPrice(dumpsterType.price);
    setPriceDialog(true);
  };

  const openEditClientDialog = (client) => {
    setEditingClient({...client});
    setEditClientDialog(true);
  };

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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
              <Card 
                className="bg-gradient-to-r from-blue-500 to-blue-600 text-white cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setActiveTab('clients')}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium opacity-90">Total Clientes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{dashboardStats.total_clients || 0}</div>
                </CardContent>
              </Card>
              
              <Card 
                className="bg-gradient-to-r from-green-500 to-green-600 text-white cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => {
                  setActiveTab('rentals');
                  setRentalViewMode('active');
                }}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium opacity-90">Caçambas Ativas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{dashboardStats.active_dumpsters || 0}</div>
                </CardContent>
              </Card>
              
              <Card 
                className="bg-gradient-to-r from-orange-500 to-orange-600 text-white cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => {
                  setActiveTab('rentals');
                  setRentalViewMode('retrieved');
                }}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium opacity-90">Caçambas Retiradas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{dashboardStats.retrieved_dumpsters || 0}</div>
                </CardContent>
              </Card>
              
              <Card 
                className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => {
                  setActiveTab('rentals');
                  // Filter expired rentals
                }}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium opacity-90">Caçambas Vencidas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{dashboardStats.expired_dumpsters || 0}</div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white cursor-pointer hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium opacity-90">Caçambas 30+ Dias</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{dashboardStats.overdue_dumpsters || 0}</div>
                </CardContent>
              </Card>
              
              <Card 
                className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setFinancialDialog(true)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium opacity-90">Ver Financeiro</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-bold">Resumo Mensal</div>
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
                    <DialogDescription>Preencha os dados do cliente. Nome e endereço são obrigatórios.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="client-name">Nome *</Label>
                        <Input
                          id="client-name"
                          value={newClient.name}
                          onChange={(e) => setNewClient({...newClient, name: e.target.value})}
                          placeholder="Nome do cliente"
                        />
                      </div>
                      <div>
                        <Label htmlFor="client-phone">Telefone</Label>
                        <Input
                          id="client-phone"
                          value={newClient.phone}
                          onChange={(e) => setNewClient({...newClient, phone: e.target.value})}
                          placeholder="(11) 99999-9999"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="client-address">Endereço *</Label>
                      <Input
                        id="client-address"
                        value={newClient.address}
                        onChange={(e) => setNewClient({...newClient, address: e.target.value})}
                        placeholder="Endereço principal"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="client-cpf-cnpj">CPF/CNPJ</Label>
                        <Input
                          id="client-cpf-cnpj"
                          value={newClient.cpf_cnpj}
                          onChange={(e) => setNewClient({...newClient, cpf_cnpj: e.target.value})}
                          placeholder="000.000.000-00"
                        />
                      </div>
                      <div>
                        <Label htmlFor="client-email">Email</Label>
                        <Input
                          id="client-email"
                          type="email"
                          value={newClient.email}
                          onChange={(e) => setNewClient({...newClient, email: e.target.value})}
                          placeholder="email@exemplo.com"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="client-additional-address">Endereço Adicional</Label>
                      <Input
                        id="client-additional-address"
                        value={newClient.additional_address}
                        onChange={(e) => setNewClient({...newClient, additional_address: e.target.value})}
                        placeholder="Endereço secundário (opcional)"
                      />
                    </div>
                    <div>
                      <Label htmlFor="client-notes">Observações</Label>
                      <Textarea
                        id="client-notes"
                        value={newClient.notes}
                        onChange={(e) => setNewClient({...newClient, notes: e.target.value})}
                        placeholder="Observações sobre o cliente"
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
                <Card key={client.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center space-x-2">
                        <Users className="h-5 w-5 text-blue-600" />
                        <span>{client.name}</span>
                      </CardTitle>
                      <div className="flex space-x-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditClientDialog(client);
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteClient(client.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="cursor-pointer" onClick={() => getClientStats(client.id)}>
                    <div className="space-y-2">
                      <div className="flex items-start space-x-2">
                        <MapPin className="h-4 w-4 text-gray-400 mt-1" />
                        <p className="text-sm text-gray-600">{client.address}</p>
                      </div>
                      {client.phone && (
                        <div className="flex items-center space-x-2">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <p className="text-sm text-gray-600">{client.phone}</p>
                        </div>
                      )}
                      {client.email && (
                        <div className="flex items-center space-x-2">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <p className="text-sm text-gray-600">{client.email}</p>
                        </div>
                      )}
                      {client.cpf_cnpj && (
                        <div className="flex items-center space-x-2">
                          <CreditCard className="h-4 w-4 text-gray-400" />
                          <p className="text-sm text-gray-600">{client.cpf_cnpj}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Rentals Tab */}
          <TabsContent value="rentals" className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Pesquisar por cliente, endereço ou código..."
                    className="pl-10 w-80"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                <div className="flex space-x-2">
                  <Button
                    variant={rentalViewMode === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRentalViewMode('all')}
                  >
                    Todas
                  </Button>
                  <Button
                    variant={rentalViewMode === 'active' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRentalViewMode('active')}
                  >
                    Ativas ({activeRentals.length})
                  </Button>
                  <Button
                    variant={rentalViewMode === 'retrieved' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setRentalViewMode('retrieved')}
                  >
                    Retiradas ({retrievedRentals.length})
                  </Button>
                </div>
              </div>
              
              <Dialog open={rentalDialog} onOpenChange={setRentalDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-green-600 hover:bg-green-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Locação
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Adicionar Nova Locação</DialogTitle>
                    <DialogDescription>Preencha os dados da locação abaixo.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="unregistered-client"
                        checked={newRental.use_unregistered_client}
                        onCheckedChange={(checked) => setNewRental({...newRental, use_unregistered_client: checked})}
                      />
                      <Label htmlFor="unregistered-client">Cliente não cadastrado</Label>
                    </div>
                    
                    {newRental.use_unregistered_client ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="rental-client-name">Nome do Cliente</Label>
                          <Input
                            id="rental-client-name"
                            value={newRental.client_name}
                            onChange={(e) => setNewRental({...newRental, client_name: e.target.value})}
                            placeholder="Nome do cliente"
                          />
                        </div>
                        <div>
                          <Label htmlFor="rental-client-phone">Telefone</Label>
                          <Input
                            id="rental-client-phone"
                            value={newRental.client_phone}
                            onChange={(e) => setNewRental({...newRental, client_phone: e.target.value})}
                            placeholder="(11) 99999-9999"
                          />
                        </div>
                        <div className="col-span-2">
                          <Label htmlFor="rental-client-address">Endereço do Cliente</Label>
                          <Input
                            id="rental-client-address"
                            value={newRental.client_address}
                            onChange={(e) => setNewRental({...newRental, client_address: e.target.value})}
                            placeholder="Endereço do cliente"
                          />
                        </div>
                      </div>
                    ) : (
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
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
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
              {filteredRentals().map((rental) => (
                <Card key={rental.id} className={`border-2 ${getStatusColor(rental.color_status)} transition-all hover:shadow-lg`}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Caçamba {rental.dumpster_code}</span>
                      <div className="flex items-center space-x-2">
                        <Badge className={getStatusColor(rental.color_status)}>
                          {getStatusText(rental.color_status, rental.status)}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => deleteRentalNote(rental.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="font-medium">{rental.client_name}</p>
                      <p className="text-sm text-gray-600 flex items-center">
                        <MapPin className="h-4 w-4 mr-1" />
                        {rental.client_address}
                      </p>
                      {rental.client_phone && (
                        <p className="text-sm text-gray-600 flex items-center">
                          <Phone className="h-4 w-4 mr-1" />
                          {rental.client_phone}
                        </p>
                      )}
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
            <div className="flex justify-between items-center">
              <div className="flex space-x-2">
                <Button onClick={() => setFinancialDialog(true)}>
                  Ver Resumo Mensal Completo
                </Button>
                
                <Dialog open={reportDialog} onOpenChange={setReportDialog}>
                  <DialogTrigger asChild>
                    <Button className="bg-green-600 hover:bg-green-700">
                      <Download className="h-4 w-4 mr-2" />
                      Gerar Extrato PDF
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Gerar Extrato Detalhado</DialogTitle>
                      <DialogDescription>Selecione o período para o extrato em PDF</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="start-date">Data Inicial</Label>
                          <Input
                            id="start-date"
                            type="date"
                            value={reportDates.start_date}
                            onChange={(e) => setReportDates({...reportDates, start_date: e.target.value})}
                          />
                        </div>
                        <div>
                          <Label htmlFor="end-date">Data Final</Label>
                          <Input
                            id="end-date"
                            type="date"
                            value={reportDates.end_date}
                            onChange={(e) => setReportDates({...reportDates, end_date: e.target.value})}
                          />
                        </div>
                      </div>
                      <Button onClick={generateDetailedReport} disabled={loading} className="w-full">
                        {loading ? 'Gerando PDF...' : 'Gerar Extrato PDF'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              
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

            {/* Financial Summary Cards */}
            {monthlyFinancial && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-green-50">
                  <CardHeader>
                    <CardTitle className="text-green-700">Recebido no Mês</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-green-600">R$ {monthlyFinancial.total_received.toFixed(2)}</p>
                    <p className="text-sm text-gray-600">{monthlyFinancial.month}</p>
                  </CardContent>
                </Card>
                <Card className="bg-red-50">
                  <CardHeader>
                    <CardTitle className="text-red-700">Pago no Mês</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-red-600">R$ {monthlyFinancial.total_paid.toFixed(2)}</p>
                    <p className="text-sm text-gray-600">{monthlyFinancial.month}</p>
                  </CardContent>
                </Card>
                <Card className="bg-blue-50">
                  <CardHeader>
                    <CardTitle className="text-blue-700">Receita Líquida</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-blue-600">R$ {monthlyFinancial.net_income.toFixed(2)}</p>
                    <p className="text-sm text-gray-600">{monthlyFinancial.month}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Recebimentos Automáticos</CardTitle>
                <CardDescription>Recebimentos registrados automaticamente quando caçambas são marcadas como pagas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {receivables.length > 0 ? receivables.slice(0, 10).map((receivable) => (
                    <div key={receivable.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div>
                        <p className="font-medium">{receivable.client_name}</p>
                        <p className="text-sm text-gray-600">Caçamba: {receivable.dumpster_code}</p>
                        <p className="text-xs text-gray-500">
                          Recebido em: {new Date(receivable.received_date).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">R$ {receivable.amount.toFixed(2)}</p>
                      </div>
                    </div>
                  )) : (
                    <p className="text-gray-500 text-center py-4">Nenhum recebimento registrado</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pagamentos Registrados</CardTitle>
                <CardDescription>Lista de todos os pagamentos do sistema</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {payments.length > 0 ? payments.map((payment) => (
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
                  )) : (
                    <p className="text-gray-500 text-center py-4">Nenhum pagamento registrado</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Configuração de Preços</CardTitle>
                <CardDescription>Gerencie os preços das caçambas por tamanho - clique em "Alterar Preço" para modificar</CardDescription>
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
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full"
                            onClick={() => openPriceDialog(type)}
                          >
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

      {/* Edit Client Dialog */}
      <Dialog open={editClientDialog} onOpenChange={setEditClientDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
            <DialogDescription>Altere os dados do cliente. Nome e endereço são obrigatórios.</DialogDescription>
          </DialogHeader>
          {editingClient && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-client-name">Nome *</Label>
                  <Input
                    id="edit-client-name"
                    value={editingClient.name}
                    onChange={(e) => setEditingClient({...editingClient, name: e.target.value})}
                    placeholder="Nome do cliente"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-client-phone">Telefone</Label>
                  <Input
                    id="edit-client-phone"
                    value={editingClient.phone || ''}
                    onChange={(e) => setEditingClient({...editingClient, phone: e.target.value})}
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-client-address">Endereço *</Label>
                <Input
                  id="edit-client-address"
                  value={editingClient.address}
                  onChange={(e) => setEditingClient({...editingClient, address: e.target.value})}
                  placeholder="Endereço principal"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-client-cpf-cnpj">CPF/CNPJ</Label>
                  <Input
                    id="edit-client-cpf-cnpj"
                    value={editingClient.cpf_cnpj || ''}
                    onChange={(e) => setEditingClient({...editingClient, cpf_cnpj: e.target.value})}
                    placeholder="000.000.000-00"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-client-email">Email</Label>
                  <Input
                    id="edit-client-email"
                    type="email"
                    value={editingClient.email || ''}
                    onChange={(e) => setEditingClient({...editingClient, email: e.target.value})}
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-client-additional-address">Endereço Adicional</Label>
                <Input
                  id="edit-client-additional-address"
                  value={editingClient.additional_address || ''}
                  onChange={(e) => setEditingClient({...editingClient, additional_address: e.target.value})}
                  placeholder="Endereço secundário (opcional)"
                />
              </div>
              <div>
                <Label htmlFor="edit-client-notes">Observações</Label>
                <Textarea
                  id="edit-client-notes"
                  value={editingClient.notes || ''}
                  onChange={(e) => setEditingClient({...editingClient, notes: e.target.value})}
                  placeholder="Observações sobre o cliente"
                />
              </div>
              <Button onClick={updateClient} disabled={loading} className="w-full">
                {loading ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Price Dialog */}
      <Dialog open={priceDialog} onOpenChange={setPriceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Preço - {selectedDumpsterType?.size}</DialogTitle>
            <DialogDescription>Digite o novo preço para {selectedDumpsterType?.volume}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-price">Novo Preço (R$)</Label>
              <Input
                id="new-price"
                type="number"
                step="0.01"
                value={newPrice}
                onChange={(e) => setNewPrice(parseFloat(e.target.value))}
                placeholder="0.00"
              />
            </div>
            <Button onClick={updateDumpsterPrice} disabled={loading} className="w-full">
              {loading ? 'Atualizando...' : 'Atualizar Preço'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Financial Summary Dialog */}
      <Dialog open={financialDialog} onOpenChange={setFinancialDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Resumo Financeiro</DialogTitle>
            <DialogDescription>Relatório detalhado de recebimentos e pagamentos</DialogDescription>
          </DialogHeader>
          
          {/* Date Range Selection */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <Label htmlFor="financial-start-date">Data Inicial</Label>
              <Input
                id="financial-start-date"
                type="date"
                value={financialDateRange.start_date}
                onChange={(e) => setFinancialDateRange({...financialDateRange, start_date: e.target.value})}
              />
            </div>
            <div>
              <Label htmlFor="financial-end-date">Data Final</Label>
              <Input
                id="financial-end-date"
                type="date"
                value={financialDateRange.end_date}
                onChange={(e) => setFinancialDateRange({...financialDateRange, end_date: e.target.value})}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={updateFinancialSummary} className="w-full">
                Atualizar Resumo
              </Button>
            </div>
          </div>
          
          {monthlyFinancial && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4 text-center">
                <Card className="bg-green-50">
                  <CardContent className="p-4">
                    <p className="text-2xl font-bold text-green-600">R$ {monthlyFinancial.total_received.toFixed(2)}</p>
                    <p className="text-sm text-gray-600">Total Recebido</p>
                  </CardContent>
                </Card>
                <Card className="bg-red-50">
                  <CardContent className="p-4">
                    <p className="text-2xl font-bold text-red-600">R$ {monthlyFinancial.total_paid.toFixed(2)}</p>
                    <p className="text-sm text-gray-600">Total Pago</p>
                  </CardContent>
                </Card>
                <Card className="bg-blue-50">
                  <CardContent className="p-4">
                    <p className="text-2xl font-bold text-blue-600">R$ {monthlyFinancial.net_income.toFixed(2)}</p>
                    <p className="text-sm text-gray-600">Receita Líquida</p>
                  </CardContent>
                </Card>
              </div>
              
              <div className="text-center text-sm text-gray-600">
                Período: {monthlyFinancial.month}
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-green-600 mb-3">Recebimentos</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {monthlyFinancial.receivables && monthlyFinancial.receivables.length > 0 ? (
                      monthlyFinancial.receivables.map((receivable, index) => (
                        <div key={index} className="p-2 bg-green-50 rounded text-sm">
                          <p className="font-medium">{receivable.client_name}</p>
                          <p className="text-gray-600">Caçamba: {receivable.dumpster_code || receivable.account_name}</p>
                          <p className="text-green-600 font-bold">R$ {receivable.amount.toFixed(2)}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-center py-4">Nenhum recebimento no período</p>
                    )}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-red-600 mb-3">Pagamentos</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {monthlyFinancial.payments && monthlyFinancial.payments.length > 0 ? (
                      monthlyFinancial.payments.map((payment, index) => (
                        <div key={index} className="p-2 bg-red-50 rounded text-sm">
                          <p className="font-medium">{payment.account_name}</p>
                          <p className="text-gray-600">{payment.description}</p>
                          <p className="text-red-600 font-bold">R$ {payment.amount.toFixed(2)}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-center py-4">Nenhum pagamento no período</p>
                    )}
                  </div>
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