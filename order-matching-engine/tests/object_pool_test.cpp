#include "common/object_pool.hpp"
#include <cstdlib>
#include <iostream>
#include <string>
#include <vector>

using namespace common;

#define ASSERT_TRUE(condition, message) \
    do { \
        if (!(condition)) { \
            std::cerr << "FAILED: " << (message) << " (" << __FILE__ << ":" << __LINE__ << ")\n"; \
            std::exit(1); \
        } \
    } while (0)

#define ASSERT_EQ(actual, expected, message) \
    do { \
        if ((actual) != (expected)) { \
            std::cerr << "FAILED: " << (message) << " [Expected: " << (expected) \
                      << ", Actual: " << (actual) << "] (" << __FILE__ << ":" << __LINE__ << ")\n"; \
            std::exit(1); \
        } \
    } while (0)

struct TestNode {
    int id;
    std::string name;
    TestNode(int i, std::string n) : id(i), name(std::move(n)) {}
};

void testObjectPoolAcquireRelease() {
    ObjectPool<TestNode, 4> pool(2); // 2 blocks of 4 = 8 initial slots
    ASSERT_EQ(pool.totalCapacity(), 8, "Initial capacity should be 8");
    ASSERT_EQ(pool.available(), 8, "Initial available should be 8");

    TestNode* n1 = pool.acquire(1, "Alpha");
    TestNode* n2 = pool.acquire(2, "Beta");

    ASSERT_EQ(n1->id, 1, "n1 id mismatch");
    ASSERT_EQ(n1->name, "Alpha", "n1 name mismatch");
    ASSERT_EQ(n2->id, 2, "n2 id mismatch");
    ASSERT_EQ(n2->name, "Beta", "n2 name mismatch");
    ASSERT_EQ(pool.available(), 6, "Available should be 6 after 2 acquires");

    pool.release(n1);
    ASSERT_EQ(pool.available(), 7, "Available should be 7 after releasing n1");

    // Reacquired slot should be reused
    TestNode* n3 = pool.acquire(3, "Gamma");
    ASSERT_EQ(n3->id, 3, "n3 id mismatch");
    ASSERT_EQ(n3, n1, "Pool should reuse the released slot");

    pool.release(n2);
    pool.release(n3);
    ASSERT_EQ(pool.available(), 8, "Available should return to 8 after all released");
}

void testObjectPoolDynamicGrowth() {
    ObjectPool<int, 4> pool(1); // 1 block of 4 slots
    ASSERT_EQ(pool.totalCapacity(), 4, "Initial capacity should be 4");

    std::vector<int*> ptrs;
    for (int i = 0; i < 10; ++i) {
        ptrs.push_back(pool.acquire(i * 10));
    }

    ASSERT_TRUE(pool.totalCapacity() >= 10, "Pool should grow automatically");
    for (int i = 0; i < 10; ++i) {
        ASSERT_EQ(*ptrs[i], i * 10, "Value integrity after growth mismatch");
        pool.release(ptrs[i]);
    }
}

int main() {
    std::cout << "Running ObjectPool unit tests...\n";
    testObjectPoolAcquireRelease();
    std::cout << "  [PASS] testObjectPoolAcquireRelease\n";
    testObjectPoolDynamicGrowth();
    std::cout << "  [PASS] testObjectPoolDynamicGrowth\n";
    std::cout << "All ObjectPool tests passed successfully!\n";
    return 0;
}
