# Shot Chart Coordinate System Calibration

## Analysis Results

Based on analysis of **47,009 shots** from multiple games:

### Key Findings

1. **Scale Factor**: **10 coordinate units = 1 foot**
   - Average scale: 10.00 units/foot
   - Median scale: 9.99 units/foot
   - Range: 5.00 to 14.87 units/foot

2. **Basket Position**: **Basket is at (0, 0)** in the legacy coordinate system
   - Average error when assuming basket at (0,0): **2.78 coordinate units** (0.28 feet)
   - This confirms the basket is indeed at the origin

3. **Coordinate System**:
   - **xLegacy**: 
     - Negative = left side of basket
     - Positive = right side of basket
     - Range: approximately -250 to +250 (25 feet left/right of center)
   - **yLegacy**: 
     - Positive = away from basket toward half court
     - Negative = behind basket (rare, ~16 shots out of 47k)
     - Range: typically 0 to ~300 (0 to 30 feet from basket)

4. **Distance Calculation**:
   ```
   distance_in_feet = sqrt(xLegacy² + yLegacy²) / 10
   ```
   This matches the `shotDistance` from descriptions with high accuracy.

## Conversion to SVG Coordinates

### SVG Coordinate System
- **SVG viewBox**: `0 0 250 235` (width x height)
- **Scale**: 5 SVG units = 1 foot
- **Court dimensions**: 50 feet wide × 47 feet deep (half court)
- **Basket position**: Top center at x=125, y=0 (visually drawn at y=10)

### Conversion Formulas

```typescript
// X coordinate: map from [-250, +250] to [0, 250]
svgX = (xLegacy + 250) / 2

// Y coordinate: map from [0, 470] to [0, 235]
svgY = yLegacy / 2
```

### Examples

| Shot Distance | xLegacy | yLegacy | Calculated Distance | SVG X | SVG Y |
|--------------|---------|---------|---------------------|-------|-------|
| 1 ft | -10 | 4 | 1.08 ft | 120 | 2 |
| 9 ft | 76 | 46 | 8.88 ft | 163 | 23 |
| 24 ft | 232 | 50 | 23.73 ft | 241 | 25 |
| 27 ft | -71 | 259 | 26.86 ft | 90 | 130 |

## Implementation

The calibration is implemented in `src/components/Charts/ShotChartTable.tsx`:

- `normalizeShotCoordinates()`: Converts legacy coordinates to SVG coordinates
- Uses the calibrated scale factor (10 units/foot → 5 SVG units/foot)
- Handles edge cases (negative yLegacy, out-of-bounds coordinates)

## Validation

The coordinate system was validated by:
1. Comparing calculated distances (from xLegacy/yLegacy) with shotDistance from descriptions
2. Analyzing 47,009 shots across multiple games
3. Verifying consistency across different periods
4. Checking coordinate ranges and distributions

## Notes

- Shots with negative yLegacy (behind basket) are rare but handled by clamping to 0
- All shots analyzed were within half court distance (yLegacy < 470)
- The coordinate system is consistent across all periods (no period-based flipping needed for shots within half court)

