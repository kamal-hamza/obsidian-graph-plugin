#ifndef ENGINE_H_
#define ENGINE_H_

#include <vector>
#include <string>

struct Point {
    double x;
    double y;
    double z; // Set this to 0 for 2d
};

enum class ResultType {
    ZERO,
    INTERCEPT,
    MAXIMA,
    MINIMA
};

struct InterestingPoint {
    Point location;
    ResultType type;
    std::string label;
};

struct GraphResult {
    std::vector<Point> path;
    std::vector<InterestingPoint> points;
    bool success;
    std::string error_message;
};

#endif