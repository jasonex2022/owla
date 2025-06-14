'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface Zone {
  id: number;
  name: string;
  center_lat: number;
  center_lng: number;
  status?: {
    crews: any[];
    totalProtesters: number;
    policeActivity?: any;
  };
}

interface ZoneMapProps {
  zones: Zone[];
  selectedZone?: Zone | null;
  onZoneClick?: (zone: Zone) => void;
}

export default function ZoneMap({ zones, selectedZone, onZoneClick }: ZoneMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    const updateDimensions = () => {
      if (canvasRef.current?.parentElement) {
        const rect = canvasRef.current.parentElement.getBoundingClientRect();
        setDimensions({
          width: rect.width,
          height: Math.min(rect.width * 0.75, 600) // Maintain aspect ratio
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (!canvasRef.current || zones.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#0A0A0A';
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    // LA bounds (approximate)
    const bounds = {
      minLat: 33.7,
      maxLat: 34.4,
      minLng: -118.7,
      maxLng: -118.0
    };

    // Convert lat/lng to canvas coordinates
    const toCanvas = (lat: number, lng: number) => {
      const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * dimensions.width;
      const y = ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * dimensions.height;
      return { x, y };
    };

    // Draw grid
    ctx.strokeStyle = '#1F1F1F';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const x = (i / 10) * dimensions.width;
      const y = (i / 10) * dimensions.height;
      
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, dimensions.height);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(dimensions.width, y);
      ctx.stroke();
    }

    // Draw zones
    zones.forEach(zone => {
      const pos = toCanvas(zone.center_lat, zone.center_lng);
      const hasCrews = (zone.status?.crews?.length ?? 0) > 0;
      const hasPolice = zone.status?.policeActivity;
      
      // Zone circle
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 20, 0, Math.PI * 2);
      
      if (hasPolice) {
        ctx.fillStyle = '#DC2626'; // Red for danger
      } else if (hasCrews) {
        ctx.fillStyle = '#FCD34D'; // Yellow for active
      } else {
        ctx.fillStyle = '#1F1F1F'; // Gray for inactive
      }
      
      ctx.fill();
      
      // Border
      ctx.strokeStyle = selectedZone?.id === zone.id ? '#FFFFFF' : '#666666';
      ctx.lineWidth = selectedZone?.id === zone.id ? 3 : 1;
      ctx.stroke();
      
      // Zone name
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(zone.name.toUpperCase(), pos.x, pos.y + 35);
      
      // Crew count
      if (hasCrews) {
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 14px Arial';
        ctx.fillText(zone.status?.totalProtesters.toString() || '0', pos.x, pos.y + 5);
      }
    });

    // Draw legend
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    
    const legendY = dimensions.height - 40;
    
    // Active zones
    ctx.fillStyle = '#FCD34D';
    ctx.fillRect(20, legendY, 15, 15);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('ACTIVE', 40, legendY + 12);
    
    // Danger zones
    ctx.fillStyle = '#DC2626';
    ctx.fillRect(100, legendY, 15, 15);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('DANGER', 120, legendY + 12);
    
    // Empty zones
    ctx.fillStyle = '#1F1F1F';
    ctx.fillRect(180, legendY, 15, 15);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('EMPTY', 200, legendY + 12);

  }, [zones, dimensions, selectedZone]);

  // Handle clicks
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !onZoneClick) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // LA bounds
    const bounds = {
      minLat: 33.7,
      maxLat: 34.4,
      minLng: -118.7,
      maxLng: -118.0
    };

    // Check if click is near any zone
    zones.forEach(zone => {
      const zoneX = ((zone.center_lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * dimensions.width;
      const zoneY = ((bounds.maxLat - zone.center_lat) / (bounds.maxLat - bounds.minLat)) * dimensions.height;
      
      const distance = Math.sqrt(Math.pow(x - zoneX, 2) + Math.pow(y - zoneY, 2));
      if (distance < 25) { // Click radius
        onZoneClick(zone);
      }
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full bg-protest-gray border-2 border-protest-red p-4"
    >
      <h3 className="text-lg font-protest uppercase mb-4">LA PROTEST ZONES</h3>
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full cursor-pointer"
        onClick={handleCanvasClick}
      />
      <p className="text-xs text-gray-400 mt-2 uppercase">
        Click zones for details • Updates every 50 seconds
      </p>
    </motion.div>
  );
}