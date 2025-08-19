import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';

// Simple stable map component
const RealMap = ({ 
  mapData, 
  landfills,
  addingMarker, 
  newMarkerPos, 
  onMapClick, 
  onMarkerConfirm
}) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    // Initialize map only once
    if (mapRef.current && !mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current).setView([-22.4386, -46.8289], 14);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapInstanceRef.current);

      // Handle map clicks
      mapInstanceRef.current.on('click', function(e) {
        if (addingMarker) {
          onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
        }
      });
    }

    return () => {
      // Cleanup markers on unmount
      markersRef.current.forEach(marker => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.removeLayer(marker);
        }
      });
      markersRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => {
      mapInstanceRef.current.removeLayer(marker);
    });
    markersRef.current = [];

    // Add dumpster markers
    mapData.forEach(rental => {
      const color = getMarkerColor(rental.color_status);
      const marker = L.circleMarker([rental.latitude, rental.longitude], {
        radius: 8,
        fillColor: color,
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      });

      marker.bindPopup(`
        <div class="p-2">
          <h3 class="font-bold mb-2">🚛 Caçamba ${rental.dumpster_code}</h3>
          <p><strong>Cliente:</strong> ${rental.client_name}</p>
          <p><strong>Endereço:</strong> ${rental.client_address}</p>
          <p><strong>Tamanho:</strong> ${rental.dumpster_size}</p>
          <p><strong>Data:</strong> ${new Date(rental.rental_date).toLocaleDateString('pt-BR')}</p>
          <p><strong>Valor:</strong> R$ ${rental.price.toFixed(2)}</p>
          <p><strong>Status:</strong> ${getStatusText(rental.color_status, rental.status)}</p>
          ${rental.is_paid ? '<p class="text-green-600">✅ Pago</p>' : ''}
          ${rental.description ? `<p class="text-xs mt-2"><strong>Obs:</strong> ${rental.description}</p>` : ''}
        </div>
      `);

      marker.addTo(mapInstanceRef.current);
      markersRef.current.push(marker);
    });

    // Add landfill markers
    landfills.forEach(landfill => {
      const marker = L.marker([landfill.latitude, landfill.longitude], {
        icon: L.divIcon({
          html: '<div style="background: #3b82f6; color: white; width: 24px; height: 24px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">🏭</div>',
          className: 'custom-landfill-marker',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        })
      });

      marker.bindPopup(`
        <div class="p-2">
          <h3 class="font-bold mb-2">🏭 ${landfill.name}</h3>
          <p><strong>Endereço:</strong> ${landfill.address}</p>
          ${landfill.capacity ? `<p><strong>Capacidade:</strong> ${landfill.capacity}m³</p>` : ''}
          ${landfill.description ? `<p class="text-xs mt-2">${landfill.description}</p>` : ''}
        </div>
      `);

      marker.addTo(mapInstanceRef.current);
      markersRef.current.push(marker);
    });

    // Add new marker position
    if (newMarkerPos) {
      const marker = L.marker([newMarkerPos.lat, newMarkerPos.lng], {
        icon: L.divIcon({
          html: '<div style="background: #ff6b6b; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
          className: 'custom-new-marker',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        })
      });

      marker.bindPopup(`
        <div class="p-2 text-center">
          <div class="mb-2">📍 Nova Posição</div>
          <div class="text-xs text-gray-600 mb-2">
            ${newMarkerPos.lat.toFixed(6)}, ${newMarkerPos.lng.toFixed(6)}
          </div>
          <button onclick="window.confirmMarker()" style="background: #3b82f6; color: white; padding: 4px 8px; border-radius: 4px; border: none; cursor: pointer; font-size: 12px;">
            Confirmar Posição
          </button>
        </div>
      `);

      // Set global function for button click
      window.confirmMarker = () => onMarkerConfirm(newMarkerPos);

      marker.addTo(mapInstanceRef.current);
      markersRef.current.push(marker);
    }

  }, [mapData, landfills, newMarkerPos]);

  const getMarkerColor = (colorStatus) => {
    switch (colorStatus) {
      case 'green': return '#10b981';
      case 'yellow': return '#f59e0b';
      case 'red': return '#ef4444';
      case 'purple': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  const getStatusText = (colorStatus, status) => {
    if (status === 'retrieved') return 'Retirada';
    switch (colorStatus) {
      case 'green': return 'No Prazo (0-7 dias)';
      case 'yellow': return 'Vencida (7-30 dias)';
      case 'purple': return 'Abandonada (30+ dias)';
      default: return 'Status Desconhecido';
    }
  };

  // Simple address search
  const handleSearchInput = async (value) => {
    setSearchQuery(value);
    if (value.length > 3) {
      const mockResults = [
        `${value} - Centro, Itapira, SP`,
        `${value} - Vila Esperança, Itapira, SP`, 
        `${value} - Jardim Paulista, Itapira, SP`,
        `${value} - Vila Rubim, Itapira, SP`
      ];
      setSearchResults(mockResults);
    } else {
      setSearchResults([]);
    }
  };

  const handleSearchSelect = (address) => {
    const baseCoords = [-22.4386, -46.8289];
    const randomOffset = () => (Math.random() - 0.5) * 0.01;
    
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([
        baseCoords[0] + randomOffset(),
        baseCoords[1] + randomOffset()
      ], 17);
    }
    
    setSearchQuery(address);
    setSearchResults([]);
  };

  return (
    <div className="relative h-full">
      {/* Search bar */}
      <div className="absolute top-4 left-4 z-1000" style={{ zIndex: 1000 }}>
        <Input
          type="text"
          placeholder="Pesquisar endereço em Itapira..."
          value={searchQuery}
          onChange={(e) => handleSearchInput(e.target.value)}
          className="w-80 bg-white shadow-lg"
        />
        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto mt-1">
            {searchResults.map((result, index) => (
              <div
                key={index}
                className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                onClick={() => handleSearchSelect(result)}
              >
                {result}
              </div>
            ))}
          </div>
        )}
      </div>

      <div ref={mapRef} className="h-full w-full rounded-lg" />
    </div>
  );
};

export default RealMap;