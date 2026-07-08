#include <iostream>
#include <cmath>
#include <string>
#include <map>
#include <chrono>
#include <thread>
#include <algorithm>

struct SessionState {
    std::string mode = "CHARGING";
    double soc = 0.0;
    double accumKwh = 0.0;
    double accumCost = 0.0;
    double costLimit = 500.0;
    std::string postLimitPreference = "STANDBY";
};

std::map<std::string, SessionState> sessionStates = {
    {"n1", {"CHARGING", 12.0, 0.0, 0.0, 500.0, "STANDBY"}},
    {"n2", {"CHARGING", 38.0, 0.0, 0.0, 800.0, "DISCHARGE"}},
    {"n3", {"CHARGING", 62.0, 0.0, 0.0, 300.0, "STANDBY"}}
};

int systemTick = 0;

void processSystemTick() {
    systemTick = (systemTick > 460) ? 1 : systemTick + 1;
    
    // ₹ INR Tariff Matrix
    double currentTariff = (systemTick > 320) ? 18.00 : ((systemTick > 150) ? 12.00 : 8.00);

    for (auto& pair : sessionStates) {
        SessionState& state = pair.second;
        double current = 0.0;

        if (state.mode == "CHARGING" && (state.soc >= 100.0 || state.accumCost >= state.costLimit)) {
            state.mode = state.postLimitPreference;
        }

        if (state.mode == "CHARGING") {
            double addition = (state.soc < 78.0) ? 0.25 : 0.08;
            state.soc = std::min(state.soc + addition, 100.0);
            current = (state.soc < 78.0) ? 32.0 : 8.0;
        } else if (state.mode == "DISCHARGE") {
            state.soc = std::max(state.soc - 0.15, 0.0);
            current = -15.0;
        } else if (state.mode == "STANDBY") {
            current = 0.0;
        }

        double powerKw = std::abs((48.0 * current) / 1000.0);
        double deltaKwh = (powerKw * 0.1) / 3600.0;
        state.accumKwh += deltaKwh;
        state.accumCost += (state.mode == "DISCHARGE") ? -(deltaKwh * (currentTariff * 1.5)) : (deltaKwh * currentTariff);
    }
}

int main() {
    std::cout << "⚡ SCADA C++ Core Engine Active\n";
    while(true) {
        processSystemTick();
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }
    return 0;
}