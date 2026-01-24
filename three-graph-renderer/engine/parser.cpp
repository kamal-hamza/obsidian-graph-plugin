#include "parser.h"
#include <stdexcept>

double MathParser::evaluate(std::string formula, double x_val, double y_val) {
    double x = x_val;
    double y = y_val;
    symbol_table_t symbol_table;
    symbol_table.add_variable("x", x);
    symbol_table.add_variable("y", y);
    symbol_table.add_constants();
    expression_t expression;
    expression.register_symbol_table(symbol_table);
    parser_t parser;
    if (!parser.compile(formula, expression)) {
        throw std::runtime_error("Invalid Equation Syntax: " + parser.error());
    }
    return expression.value();
}