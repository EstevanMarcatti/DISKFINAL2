import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-control-geocoder';
import 'leaflet-routing-machine';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';

// Custom hook for map events
const MapEvents = ({ onMapClick, addingMarker }) => {
  useMapEvents({
    click: (e) => {
      if (addingMarker) {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
  });
  return null;
};

// Geocoder component
const MapGeocoder = () => {
  const map = useMap();

  useEffect(() => {
    const geocoder = L.Control.geocoder({
      defaultMarkGeocode: false,
      placeholder: 'Pesquisar endereço em Itapira...',
      geocoder: L.Control.Geocoder.nominatim({
        geocodingQueryParams: {
          countrycodes: 'br',
          bounded: 1,
          viewbox: '-47.0,-22.6,-46.6,-22.2', // Bounding box for Itapira region
        }
      })
    }).on('markgeocode', function(e) {
      const latlng = e.geocode.center;
      L.marker(latlng).addTo(map)
        .bindPopup(e.geocode.name)
        .openPopup();
      map.setView(latlng, 16);
    }).addTo(map);

    return () => {
      map.removeControl(geocoder);
    };
  }, [map]);

  return null;
};

// Routing control component
const RoutingControl = ({ waypoints, show }) => {
  const map = useMap();
  const routingControlRef = useRef(null);

  useEffect(() => {
    if (show && waypoints.length >= 2) {
      const waypointLatLngs = waypoints.map(wp => L.latLng(wp.lat, wp.lng));
      
      routingControlRef.current = L.Routing.control({
        waypoints: waypointLatLngs,
        routeWhileDragging: true,
        geocoder: L.Control.Geocoder.nominatim(),
        addWaypoints: false,
        createMarker: function() { return null; }, // Don't create default markers
        lineOptions: {
          styles: [
            { color: '#3b82f6', weight: 6, opacity: 0.8 }
          ]
        }
      }).addTo(map);
    }

    return () => {
      if (routingControlRef.current) {
        map.removeControl(routingControlRef.current);
        routingControlRef.current = null;
      }
    };
  }, [map, waypoints, show]);

  return null;
};

const RealMap = ({ 
  mapData, 
  landfills,
  addingMarker, 
  newMarkerPos, 
  onMapClick, 
  onMarkerConfirm,
  selectedRoute,
  routeWaypoints,
  showRoute
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const mapRef = useRef();

  // Custom marker icons
  const createDumpsterIcon = (colorStatus) => {
    const colors = {
      green: '#10b981',
      yellow: '#f59e0b', 
      red: '#ef4444',
      purple: '#8b5cf6'
    };

    return new L.DivIcon({
      html: `<div class="custom-dumpster-marker marker-${colorStatus}">🚛</div>`,
      className: 'custom-leaflet-div-icon',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
  };

  const createLandfillIcon = () => {
    return new L.DivIcon({
      html: `<div class="custom-landfill-marker marker-blue">🏭</div>`,
      className: 'custom-leaflet-div-icon',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
  };

  const getStatusText = (colorStatus, status) => {
    if (status === 'retrieved') return 'Retirada';
    switch (colorStatus) {
      case 'green': return 'No Prazo (0-7 dias)';
      case 'yellow': return 'Vencida (7-30 dias)';
      case 'red': return 'Retirada';
      case 'purple': return 'Abandonada (30+ dias)';
      default: return 'Status Desconhecido';
    }
  };

  // Simple address search
  const handleSearchInput = async (value) => {
    setSearchQuery(value);
    if (value.length > 3) {
      // Mock search results for Itapira streets
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
    // For demo, center on Itapira with random offset
    const baseCoords = [-22.4386, -46.8289];
    const randomOffset = () => (Math.random() - 0.5) * 0.01;
    
    if (mapRef.current) {
      mapRef.current.setView([
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
      <div className="absolute top-4 left-4 z-1000 address-search-container">
        <Input
          type="text"
          placeholder="Pesquisar endereço em Itapira..."
          value={searchQuery}
          onChange={(e) => handleSearchInput(e.target.value)}
          className="w-80 bg-white shadow-lg"
        />
        {searchResults.length > 0 && (
          <div className="address-search-results">
            {searchResults.map((result, index) => (
              <div
                key={index}
                className="address-search-item"
                onClick={() => handleSearchSelect(result)}
              >
                {result}
              </div>
            ))}
          </div>
        )}
      </div>

      <MapContainer
        ref={mapRef}
        center={[-22.4386, -46.8289]} // Itapira, SP
        zoom={14}
        style={{ height: '100%', width: '100%' }}
        className="rounded-lg"
      >
        {/* Use OpenStreetMap tiles with better styling */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* Add geocoder control */}
        <MapGeocoder />

        {/* Map click events */}
        <MapEvents onMapClick={onMapClick} addingMarker={addingMarker} />

        {/* Render dumpster markers */}
        {mapData.map((rental) => (
          <Marker
            key={rental.id}
            position={[rental.latitude, rental.longitude]}
            icon={createDumpsterIcon(rental.color_status)}
          >
            <Popup className="custom-popup">
              <div className="p-2 min-w-64">
                <h3 className="font-bold text-lg mb-2 flex items-center">
                  🚛 Caçamba {rental.dumpster_code}
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <strong>Cliente:</strong> {rental.client_name}
                  </div>
                  <div>
                    <strong>Endereço:</strong> {rental.client_address}
                  </div>
                  <div>
                    <strong>Tamanho:</strong> {rental.dumpster_size}
                  </div>
                  <div>
                    <strong>Data:</strong> {new Date(rental.rental_date).toLocaleDateString('pt-BR')}
                  </div>
                  <div>
                    <strong>Valor:</strong> R$ {rental.price.toFixed(2)}
                  </div>
                  <div className="flex items-center space-x-2 mt-2">
                    <Badge className={`${
                      rental.color_status === 'green' ? 'bg-green-100 text-green-800' :
                      rental.color_status === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                      rental.color_status === 'red' ? 'bg-red-100 text-red-800' :
                      'bg-purple-100 text-purple-800'
                    }`}>
                      {getStatusText(rental.color_status, rental.status)}
                    </Badge>
                  </div>
                  {rental.is_paid && (
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      ✅ Pago
                    </Badge>
                  )}
                  {rental.description && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                      <strong>Obs:</strong> {rental.description}
                    </div>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Render landfill markers */}
        {landfills.map((landfill) => (
          <Marker
            key={landfill.id}
            position={[landfill.latitude, landfill.longitude]}
            icon={createLandfillIcon()}
          >
            <Popup>
              <div className="p-2">
                <h3 className="font-bold text-lg mb-2 flex items-center">
                  🏭 {landfill.name}
                </h3>
                <div className="text-sm space-y-1">
                  <div><strong>Endereço:</strong> {landfill.address}</div>
                  {landfill.capacity && (
                    <div><strong>Capacidade:</strong> {landfill.capacity}m³</div>
                  )}
                  {landfill.description && (
                    <div className="mt-2 text-xs text-gray-600">{landfill.description}</div>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* New marker when adding manually */}
        {newMarkerPos && (
          <Marker 
            position={[newMarkerPos.lat, newMarkerPos.lng]}
            icon={new L.DivIcon({
              html: '<div style="background: #ff6b6b; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white;"></div>',
              className: 'custom-leaflet-div-icon',
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            })}
          >
            <Popup>
              <div className="p-2 text-center">
                <div className="text-sm mb-2">📍 Nova Posição</div>
                <div className="text-xs text-gray-600 mb-2">
                  {newMarkerPos.lat.toFixed(6)}, {newMarkerPos.lng.toFixed(6)}
                </div>
                <Button 
                  size="sm" 
                  onClick={() => onMarkerConfirm(newMarkerPos)}
                >
                  Confirmar Posição
                </Button>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Routing control */}
        {showRoute && routeWaypoints.length > 0 && (
          <RoutingControl 
            waypoints={routeWaypoints}
            show={showRoute}
          />
        )}
      </MapContainer>
    </div>
  );
};

export default RealMap;