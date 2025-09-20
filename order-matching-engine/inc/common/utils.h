/*
Functions used in multiple modules, like logging, string manipulation, file IO, math helpers.
*/
#pragma once
#include <string>

std::string trim(const std::string& str);
bool fileExists(const std::string& path);
