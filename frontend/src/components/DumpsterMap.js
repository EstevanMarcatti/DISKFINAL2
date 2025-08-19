import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Badge, Button } from '../components/ui';

// Fix for leaflet default marker icons in React
const DefaultIcon = L.icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTQiIGZpbGw9IiMzMzczZGMiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMyIvPgo8dGV4dCB4PSIxNiIgeT0iMjEiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IndoaXRlIiBmb250LXNpemU9IjE0IiBmb250LXdlaWdodD0iYm9sZCI+8J+amiA8L3RleHQ+Cjwvc3ZnPgo=',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

L.Marker.prototype.options.icon = DefaultIcon;

const MapClickHandler = ({ addingMarker, onMapClick }) => {
  useMapEvents({
    click: (e) => {
      if (addingMarker) {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
  });
  return null;
};

const DumpsterMap = ({ 
  mapData, 
  addingMarker, 
  newMarkerPos, 
  onMapClick, 
  onMarkerConfirm,
  getMarkerColor,
  getStatusTextForMap,
  createCustomIcon
}) => {
  const [mapKey, setMapKey] = useState(Date.now());

  // Force re-render of map when component mounts
  useEffect(() => {
    setMapKey(Date.now());
  }, []);

  return (
    <MapContainer
      key={mapKey}
      center={[-22.4386, -46.8289]}
      zoom={13}
      style={{ height: '100%', width: '100%' }}
      className="rounded-lg"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      
      <MapClickHandler addingMarker={addingMarker} onMapClick={onMapClick} />
      
      {/* Render rental markers */}
      {mapData.map((rental) => (
        <Marker
          key={rental.id}
          position={[rental.latitude, rental.longitude]}
          icon={createCustomIcon(getMarkerColor(rental.color_status))}
        >
          <Popup>
            <div className="p-2 min-w-64">
              <h3 className="font-bold text-lg mb-2">Caçamba {rental.dumpster_code}</h3>
              <div className="space-y-1 text-sm">
                <p><strong>Cliente:</strong> {rental.client_name}</p>
                <p><strong>Endereço:</strong> {rental.client_address}</p>
                <p><strong>Tamanho:</strong> {rental.dumpster_size}</p>
                <p><strong>Data de Locação:</strong> {new Date(rental.rental_date).toLocaleDateString('pt-BR')}</p>
                <p><strong>Valor:</strong> R$ {rental.price.toFixed(2)}</p>
                <div className="flex items-center space-x-2 mt-2">
                  <Badge className={`${
                    rental.color_status === 'green' ? 'bg-green-100 text-green-800' :
                    rental.color_status === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                    rental.color_status === 'red' ? 'bg-red-100 text-red-800' :
                    'bg-purple-100 text-purple-800'
                  }`}>
                    {getStatusTextForMap(rental.color_status, rental.status)}
                  </Badge>
                </div>
                {rental.is_paid && (
                  <Badge variant="outline" className="bg-green-50 text-green-700">
                    Pago
                  </Badge>
                )}
                {rental.description && (
                  <p className="italic text-gray-600 mt-2">{rental.description}</p>
                )}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
      
      {/* New marker position when adding manually */}
      {newMarkerPos && (
        <Marker position={[newMarkerPos.lat, newMarkerPos.lng]}>
          <Popup>
            <div className="p-2">
              <p>Nova posição selecionada</p>
              <p>Lat: {newMarkerPos.lat.toFixed(6)}</p>
              <p>Lng: {newMarkerPos.lng.toFixed(6)}</p>
              <Button 
                size="sm" 
                className="mt-2"
                onClick={() => onMarkerConfirm(newMarkerPos)}
              >
                Confirmar Posição
              </Button>
            </div>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
};

export default DumpsterMap;