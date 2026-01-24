#ifndef PARSER_H
#define PARSER_H

#include <string>
#include "lib/exprtk.hpp"

class MathParser {
    public:
        typedef exprtk::symbol_table<double> symbol_table_t;
        typedef exprtk::expression<double>     expression_t;
        typedef exprtk::parser<double>         parser_t;
        
        double evaluate(std::string formula, double x_val, double y_val = 0.0);
};

#endif // PARSER_H