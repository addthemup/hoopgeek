#!/bin/bash

# Test script to verify Cloudflare Worker is responding
# This helps diagnose if the worker is attached to routes

echo "🔍 Testing Cloudflare Worker for hoopgeek-meta-injector"
echo "======================================================"
echo ""

# Get a test UUID (you can replace this with an actual post UUID)
TEST_UUID="test-uuid-1234-5678-90ab-cdef12345678"
DOMAIN="hoop-geek.com"

echo "1️⃣  Testing if worker responds to a UUID route..."
echo "   URL: https://${DOMAIN}/${TEST_UUID}"
echo ""

# Test with AppleBot user agent (like iMessage)
echo "📱 Testing with AppleBot user agent (simulates iMessage):"
curl -s -A "AppleBot" "https://${DOMAIN}/${TEST_UUID}" -o /dev/null -w "HTTP Status: %{http_code}\n" 2>&1

echo ""
echo "2️⃣  Testing with regular browser user agent:"
curl -s -A "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)" "https://${DOMAIN}/${TEST_UUID}" -o /dev/null -w "HTTP Status: %{http_code}\n" 2>&1

echo ""
echo "3️⃣  Checking if og:image meta tag is present in response:"
echo "   (This should show the OG image URL if worker is working)"
curl -s -A "AppleBot" "https://${DOMAIN}/${TEST_UUID}" | grep -o 'property="og:image"[^>]*' | head -1

echo ""
echo ""
echo "📋 Next Steps:"
echo "   1. If you see HTTP 200, the site is accessible"
echo "   2. If you see og:image in the output, the worker is working"
echo "   3. If you DON'T see og:image, the worker isn't attached to routes"
echo ""
echo "   To check routes in Cloudflare Dashboard:"
echo "   https://dash.cloudflare.com → Workers & Pages → hoopgeek-meta-injector → Triggers"
echo ""

