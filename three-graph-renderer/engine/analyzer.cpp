#include "analyzer.h"
#include <string>
#include <iomanip>
#include <sstream>

void GraphAnalyzer::analyzePath(GraphResult& result) {
    if (result.path.size() < 3) return;

    for (size_t i = 1; i < result.path.size() - 1; ++i) {
        const Point& prev = result.path[i - 1];
        const Point& curr = result.path[i];
        const Point& next = result.path[i + 1];

        // 1. Detect Zeros (Root finding via sign change)
        // If y changes from positive to negative (or vice versa), 
        // there is a zero between prev and curr.
        if ((prev.y > 0 && curr.y <= 0) || (prev.y < 0 && curr.y >= 0)) {
            addInterestingPoint(result, curr, ResultType::ZERO, "Zero");
        }

        // 2. Detect Y-Intercept
        // If x crosses or hits 0
        if ((prev.x < 0 && curr.x >= 0) || (prev.x == 0)) {
            addInterestingPoint(result, curr, ResultType::INTERCEPT, "Y-Intercept");
        }

        // 3. Detect Local Maxima
        // A point is a maximum if it is higher than both its neighbors
        if (curr.y > prev.y && curr.y > next.y) {
            addInterestingPoint(result, curr, ResultType::MAXIMA, "Local Max");
        }

        // 4. Detect Local Minima
        // A point is a minimum if it is lower than both its neighbors
        if (curr.y < prev.y && curr.y < next.y) {
            addInterestingPoint(result, curr, ResultType::MINIMA, "Local Min");
        }
    }
}

void GraphAnalyzer::analyze3DPath(GraphResult& result, int resolution) {
    int size = resolution + 1; // Number of points per side
    if (result.path.size() < size * size) return;

    for (int i = 1; i < size - 1; ++i) {
        for (int j = 1; j < size - 1; ++j) {
            // Calculate index of current point and its 8 neighbors
            int idx = i * size + j;
            
            double val = result.path[idx].z;
            
            // Neighbor indices
            double n  = result.path[(i-1)*size + j].z;     // North
            double s  = result.path[(i+1)*size + j].z;     // South
            double e  = result.path[i*size + (j+1)].z;     // East
            double w  = result.path[i*size + (j-1)].z;     // West
            double ne = result.path[(i-1)*size + (j+1)].z; // NE
            double nw = result.path[(i-1)*size + (j-1)].z; // NW
            double se = result.path[(i+1)*size + (j+1)].z; // SE
            double sw = result.path[(i+1)*size + (j-1)].z; // SW

            // 1. Detect 3D Maxima (Peak)
            if (val > n && val > s && val > e && val > w && 
                val > ne && val > nw && val > se && val > sw) {
                addInterestingPoint(result, result.path[idx], ResultType::MAXIMA, "Peak");
            }

            // 2. Detect 3D Minima (Pit)
            if (val < n && val < s && val < e && val < w && 
                val < ne && val < nw && val < se && val < sw) {
                addInterestingPoint(result, result.path[idx], ResultType::MINIMA, "Pit");
            }
        }
    }
}

void GraphAnalyzer::addInterestingPoint(GraphResult& result, Point p, ResultType type, std::string name) {
    std::stringstream ss;
    ss << name << ": (" << std::fixed << std::setprecision(2) << p.x << ", " << p.y << ")";
    
    InterestingPoint ip;
    ip.location = p;
    ip.type = type;
    ip.label = ss.str();
    
    result.points.push_back(ip);
}