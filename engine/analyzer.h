#ifndef ANALYZER_H
#define ANALYZER_H

#include <string>
#include "engine.hpp"

class GraphAnalyzer {
public:
    void analyzePath(GraphResult& result);
    void analyze3DPath(GraphResult& result, int resolution);

private:
    void addInterestingPoint(GraphResult& result, Point p, ResultType type, std::string name);
};

#endif // ANALYZER_H