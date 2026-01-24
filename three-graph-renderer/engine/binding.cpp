#include <emscripten/bind.h>
#include <emscripten/val.h>
#include "engine.hpp"
#include "sampler.h"
#include "analyzer.h"

using namespace emscripten;

// 1. Exporting the Data Structures
EMSCRIPTEN_BINDINGS(math_graph_module) {
    
    // Bind the Point struct
    value_object<Point>("Point")
        .field("x", &Point::x)
        .field("y", &Point::y)
        .field("z", &Point::z);

    // Bind the ResultType Enum
    enum_<ResultType>("ResultType")
        .value("ZERO", ResultType::ZERO)
        .value("INTERCEPT", ResultType::INTERCEPT)
        .value("MAXIMA", ResultType::MAXIMA)
        .value("MINIMA", ResultType::MINIMA);

    // Bind the InterestingPoint struct
    value_object<InterestingPoint>("InterestingPoint")
        .field("location", &InterestingPoint::location)
        .field("type", &InterestingPoint::type)
        .field("label", &InterestingPoint::label);

    // Bind the Vectors (This allows JS to iterate over C++ lists)
    register_vector<Point>("PointVector");
    register_vector<InterestingPoint>("InterestingPointVector");

    // Bind the main GraphResult struct
    class_<GraphResult>("GraphResult")
        .constructor<>()
        .property("path", &GraphResult::path)
        .property("points", &GraphResult::points)
        .property("success", &GraphResult::success)
        .property("errorMessage", &GraphResult::error_message);

    // 2. Exporting the High-Level Functions
    // This is what you will actually call from your TypeScript code
    
    // Wrapper for 2D
    function("calculate2D", optional_override(
        [](std::string formula, double x_min, double x_max, int res) {
            GraphSampler sampler;
            GraphAnalyzer analyzer;
            GraphResult res2d = sampler.generate2DPath(formula, x_min, x_max, res);
            if (res2d.success) analyzer.analyzePath(res2d);
            return res2d;
        })
    );

    // Wrapper for 3D
    function("calculate3D", optional_override(
        [](std::string formula, double x_min, double x_max, double y_min, double y_max, int res) {
            GraphSampler sampler;
            GraphAnalyzer analyzer;
            GraphResult res3d = sampler.generate3DPath(formula, x_min, x_max, y_min, y_max, res);
            if (res3d.success) analyzer.analyze3DPath(res3d, res);
            return res3d;
        })
    );

    // Zero-copy data extraction functions for high performance
    // These return TypedArray views directly into WASM memory, avoiding bridge overhead
    
    // Get 2D path data as Float64Array (x, y pairs, z is always 0)
    function("getPathData2D", optional_override([](const GraphResult& res) {
        if (!res.success || res.path.empty()) {
            return val::undefined();
        }
        // Return Float64Array view of raw vector memory
        // Each Point has 3 doubles (x, y, z), but for 2D we return all 3
        const size_t byte_length = res.path.size() * sizeof(Point);
        return val(typed_memory_view(
            res.path.size() * 3,
            reinterpret_cast<const double*>(res.path.data())
        ));
    }));
    
    // Get 3D path data as Float64Array (x, y, z triplets)
    function("getPathData3D", optional_override([](const GraphResult& res) {
        if (!res.success || res.path.empty()) {
            return val::undefined();
        }
        // Return Float64Array view of raw vector memory
        const size_t byte_length = res.path.size() * sizeof(Point);
        return val(typed_memory_view(
            res.path.size() * 3,
            reinterpret_cast<const double*>(res.path.data())
        ));
    }));
}