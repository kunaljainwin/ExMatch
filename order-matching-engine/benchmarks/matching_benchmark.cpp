#include "core/matching_engine.h"
#include <algorithm>
#include <chrono>
#include <iomanip>
#include <iostream>
#include <numeric>
#include <vector>

using namespace core;
using namespace common;

namespace {

uint64_t getNowNs() noexcept {
    return static_cast<uint64_t>(
        std::chrono::duration_cast<std::chrono::nanoseconds>(
            std::chrono::steady_clock::now().time_since_epoch())
            .count());
}

struct LatencyStats {
    uint64_t minNs{0};
    uint64_t maxNs{0};
    double meanNs{0.0};
    uint64_t p50Ns{0};
    uint64_t p90Ns{0};
    uint64_t p99Ns{0};
    uint64_t p999Ns{0};
    double opsPerSec{0.0};
};

LatencyStats computeStats(std::vector<uint64_t>& latencies, uint64_t totalElapsedNs) {
    if (latencies.empty()) {
        return {};
    }

    std::sort(latencies.begin(), latencies.end());

    const size_t n = latencies.size();
    const uint64_t sum = std::accumulate(latencies.begin(), latencies.end(), 0ULL);

    LatencyStats stats;
    stats.minNs = latencies.front();
    stats.maxNs = latencies.back();
    stats.meanNs = static_cast<double>(sum) / static_cast<double>(n);
    stats.p50Ns = latencies[n * 50 / 100];
    stats.p90Ns = latencies[n * 90 / 100];
    stats.p99Ns = latencies[n * 99 / 100];
    stats.p999Ns = latencies[n * 999 / 1000];

    const double elapsedSec = static_cast<double>(totalElapsedNs) / 1e9;
    stats.opsPerSec = elapsedSec > 0.0 ? (static_cast<double>(n) / elapsedSec) : 0.0;

    return stats;
}

void printBenchmarkReport(const std::string& name, size_t count, const LatencyStats& stats) {
    std::cout << "\n======================================================\n";
    std::cout << " Benchmark: " << name << "\n";
    std::cout << " Total Orders: " << count << "\n";
    std::cout << " Throughput:   " << std::fixed << std::setprecision(0) << stats.opsPerSec << " ops/sec\n";
    std::cout << "------------------------------------------------------\n";
    std::cout << " Latency (ns): \n";
    std::cout << "   Min:   " << std::setw(8) << stats.minNs << " ns\n";
    std::cout << "   Mean:  " << std::setw(8) << std::setprecision(1) << stats.meanNs << " ns\n";
    std::cout << "   P50:   " << std::setw(8) << stats.p50Ns << " ns (" << std::setprecision(2) << stats.p50Ns / 1000.0 << " us)\n";
    std::cout << "   P90:   " << std::setw(8) << stats.p90Ns << " ns (" << std::setprecision(2) << stats.p90Ns / 1000.0 << " us)\n";
    std::cout << "   P99:   " << std::setw(8) << stats.p99Ns << " ns (" << std::setprecision(2) << stats.p99Ns / 1000.0 << " us)\n";
    std::cout << "   P99.9: " << std::setw(8) << stats.p999Ns << " ns (" << std::setprecision(2) << stats.p999Ns / 1000.0 << " us)\n";
    std::cout << "   Max:   " << std::setw(8) << stats.maxNs << " ns (" << std::setprecision(2) << stats.maxNs / 1000.0 << " us)\n";
    std::cout << "======================================================\n";
}

} // namespace

int main() {
    constexpr size_t kWarmupCount = 5000;
    constexpr size_t kBenchmarkCount = 100000;

    std::cout << "Initializing ExMatch MatchingEngine benchmark...\n";

    MatchingEngine engine(65536, 65536);
    engine.start(0);

    // Warm-up phase
    std::cout << "Warming up with " << kWarmupCount << " orders...\n";
    for (size_t i = 1; i <= kWarmupCount; ++i) {
        OrderRequest req{};
        req.type = RequestType::NEW_ORDER;
        req.orderId = i;
        req.clientId = 1;
        req.side = (i % 2 == 0) ? Side::BUY : Side::SELL;
        req.orderType = OrderType::LIMIT;
        req.price = 10000 + static_cast<Price>(i % 50);
        req.quantity = 10;
        req.timestamp = getNowNs();

        while (!engine.enqueueOrder(req)) {
            std::this_thread::yield();
        }

        ExecutionReport report{};
        while (!engine.dequeueExecution(report)) {
            std::this_thread::yield();
        }
    }

    std::cout << "Running benchmark with " << kBenchmarkCount << " limit/taker orders...\n";

    std::vector<uint64_t> latencies;
    latencies.reserve(kBenchmarkCount);

    const uint64_t benchmarkStartNs = getNowNs();

    for (size_t i = 1; i <= kBenchmarkCount; ++i) {
        const uint64_t orderId = kWarmupCount + i;
        const uint64_t submitTime = getNowNs();

        OrderRequest req{};
        req.type = RequestType::NEW_ORDER;
        req.orderId = orderId;
        req.clientId = 100;
        // Half resting liquidity makers, half aggressive cross-spread takers
        req.side = (i % 2 == 0) ? Side::BUY : Side::SELL;
        req.orderType = OrderType::LIMIT;
        req.price = (req.side == Side::BUY) ? 10010 : 10005;
        req.quantity = 10;
        req.timestamp = submitTime;

        while (!engine.enqueueOrder(req)) {
            std::this_thread::yield();
        }

        ExecutionReport report{};
        while (!engine.dequeueExecution(report)) {
            std::this_thread::yield();
        }

        const uint64_t completionTime = getNowNs();
        latencies.push_back(completionTime - submitTime);

        // Drain any extra trade reports generated by crossing the spread
        while (engine.dequeueExecution(report)) {
            // Drained secondary match reports
        }
    }

    const uint64_t benchmarkEndNs = getNowNs();
    engine.stop();

    const LatencyStats stats = computeStats(latencies, benchmarkEndNs - benchmarkStartNs);
    printBenchmarkReport("MatchingEngine Ingress-to-Egress Latency", kBenchmarkCount, stats);

    return 0;
}
