#!/bin/bash

# Mobile Testing Script for OVERWHELM
# Tests critical mobile features

echo "🔥 OVERWHELM Mobile Testing"
echo "=========================="
echo ""

# Check if running
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "❌ App not running on localhost:3000"
    echo "   Run 'npm run dev' first"
    exit 1
fi

echo "✅ App is running"
echo ""

# Check manifest.json
echo "📱 Checking PWA manifest..."
if curl -s http://localhost:3000/manifest.json | grep -q "OVERWHELM"; then
    echo "✅ PWA manifest found"
else
    echo "❌ PWA manifest missing or invalid"
fi

# Check service worker
echo "👷 Checking Service Worker..."
if curl -s http://localhost:3000/sw.js | grep -q "overwhelm"; then
    echo "✅ Service worker found"
else
    echo "❌ Service worker missing"
fi

# Check mobile viewport
echo "📐 Checking mobile viewport..."
if curl -s http://localhost:3000 | grep -q "viewport-fit=cover"; then
    echo "✅ Mobile viewport configured"
else
    echo "❌ Mobile viewport not properly configured"
fi

echo ""
echo "📱 Mobile Testing Checklist:"
echo "=========================="
echo ""
echo "1. Test on actual mobile device:"
echo "   - Open http://[your-ip]:3000 on phone"
echo "   - Check if 'Add to Home Screen' works"
echo "   - Verify touch targets are 56px+ tall"
echo ""
echo "2. Test geolocation:"
echo "   - Allow location permission"
echo "   - Verify nearest zone assignment"
echo "   - Check 2km radius enforcement"
echo ""
echo "3. Test notifications:"
echo "   - Enable push notifications"
echo "   - Wait for zone rotation (30 min)"
echo "   - Verify notification received"
echo ""
echo "4. Test offline mode:"
echo "   - Add to home screen"
echo "   - Turn on airplane mode"
echo "   - Verify basic functionality works"
echo ""
echo "5. Test in sunlight:"
echo "   - High contrast colors visible?"
echo "   - Text readable outdoors?"
echo ""

# Get local IP for mobile testing
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || hostname -I | awk '{print $1}' 2>/dev/null)
if [ ! -z "$LOCAL_IP" ]; then
    echo "🌐 Test on mobile at: http://$LOCAL_IP:3000"
fi

echo ""
echo "🔥 Stay safe. Stay mobile. OVERWHELM."