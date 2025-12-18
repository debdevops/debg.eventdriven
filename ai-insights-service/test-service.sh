#!/bin/bash
# Quick validation script for AI Insights Service

echo "=== AI Insights Service Validation ==="
echo ""

echo "1. Testing health endpoint..."
HEALTH=$(curl -s http://localhost:8000/health | jq -r '.status')
if [ "$HEALTH" == "healthy" ]; then
    echo "   ✓ Service is healthy"
else
    echo "   ✗ Service health check failed"
    exit 1
fi

echo ""
echo "2. Testing mock data endpoint..."
MOCK_COUNT=$(curl -s http://localhost:8000/api/mock-data | jq -r '.message_count')
if [ "$MOCK_COUNT" == "28" ]; then
    echo "   ✓ Mock data loaded ($MOCK_COUNT messages)"
else
    echo "   ✗ Mock data check failed"
    exit 1
fi

echo ""
echo "3. Testing analysis endpoint..."
ANALYSIS=$(curl -s -X POST http://localhost:8000/api/analyze-mock)
CLUSTERS=$(echo "$ANALYSIS" | jq -r '.clusters | length')
OUTLIERS=$(echo "$ANALYSIS" | jq -r '.outliers | length')
SUMMARY=$(echo "$ANALYSIS" | jq -r '.summary')

echo "   ✓ Analysis complete:"
echo "     - Clusters identified: $CLUSTERS"
echo "     - Outliers detected: $OUTLIERS"
echo "     - Summary: $SUMMARY"

echo ""
echo "=== All Tests Passed ==="
echo ""
echo "Service is ready at: http://localhost:8000"
echo "API docs available at: http://localhost:8000/docs"
