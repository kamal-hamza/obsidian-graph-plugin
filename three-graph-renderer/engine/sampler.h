#ifndef SAMPLER_H
#define SAMPLER_H

#include <string>
#include "engine.hpp"

class GraphSampler {
public:
    GraphResult generate2DPath(std::string formula, double x_min, double x_max, int resolution);
    GraphResult generate3DPath(std::string formula, double x_min, double x_max, double y_min, double y_max, int resolution);
};

#endif // SAMPLER_H