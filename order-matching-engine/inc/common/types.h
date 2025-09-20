/*
Common Types / Aliases

Typedefs, using statements, small structs used across modules.
*/

#pragma once

#include <map>
#include <string>

namespace common {
    using StringMap = std::map<std::string, std::string>;
}


struct Point {
    int x;
    int y;
};
