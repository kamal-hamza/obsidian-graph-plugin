#include "sampler.h"
#include "lib/exprtk.hpp"
#include <cmath>

GraphResult GraphSampler::generate2DPath(std::string formula, double x_min, double x_max, int resolution) {
    GraphResult result;
    result.success = true;

    // 1. Setup ExprTk types
    typedef exprtk::symbol_table<double> symbol_table_t;
    typedef exprtk::expression<double>     expression_t;
    typedef exprtk::parser<double>         parser_t;

    double x_var;
    symbol_table_t symbol_table;
    symbol_table.add_variable("x", x_var);
    symbol_table.add_constants();

    expression_t expression;
    expression.register_symbol_table(symbol_table);

    parser_t parser;

    // 2. Compile the formula ONCE
    if (!parser.compile(formula, expression)) {
        result.success = false;
        result.error_message = "Math Error: Could not parse equation.";
        return result;
    }

    // 3. Calculate the step size
    // If we want 500 points over a range of 20, each step is 20/500
    double range = x_max - x_min;
    double step = range / static_cast<double>(resolution);

    // 4. The Sampling Loop
    // We pre-allocate memory for performance (like a List capacity in C#)
    result.path.reserve(resolution);

    for (int i = 0; i <= resolution; ++i) {
        x_var = x_min + (i * step); // Update the variable ExprTk is watching
        double y_val = expression.value(); // Evaluate the pre-compiled tree
        
        // Basic safety: avoid adding Infinite or NaN points (like 1/0)
        if (std::isfinite(y_val)) {
            result.path.push_back({x_var, y_val, 0.0});
        }
    }

    return result;
}

GraphResult GraphSampler::generate3DPath(std::string formula, double x_min, double x_max, 
                           double y_min, double y_max, int resolution) {
    GraphResult result;
    result.success = true;

    // ExprTk Setup (Same as 2D, but adding 'y' to the symbol table)
    typedef exprtk::symbol_table<double> symbol_table_t;
    typedef exprtk::expression<double>     expression_t;
    typedef exprtk::parser<double>         parser_t;

    double x_var, y_var;
    symbol_table_t symbol_table;
    symbol_table.add_variable("x", x_var);
    symbol_table.add_variable("y", y_var); // NEW: Track y as a variable
    symbol_table.add_constants();

    expression_t expression;
    expression.register_symbol_table(symbol_table);

    parser_t parser;
    if (!parser.compile(formula, expression)) {
        result.success = false;
        result.error_message = "3D Math Error: Check syntax for x and y.";
        return result;
    }

    // Calculate step sizes
    double x_step = (x_max - x_min) / resolution;
    double y_step = (y_max - y_min) / resolution;

    // Pre-allocate: For a 50x50 grid, we need 2,500 points
    result.path.reserve((resolution + 1) * (resolution + 1));

    for (int i = 0; i <= resolution; ++i) {
        x_var = x_min + (i * x_step);
        
        for (int j = 0; j <= resolution; ++j) {
            y_var = y_min + (j * y_step);
            double z_val = expression.value();

            if (std::isfinite(z_val)) {
                result.path.push_back({x_var, y_var, z_val});
            } else {
                // If Z is infinite, we still push a point with a "null" marker
                // so the grid indices stay consistent in the JS frontend.
                result.path.push_back({x_var, y_var, 0.0}); 
            }
        }
    }
    return result;
}