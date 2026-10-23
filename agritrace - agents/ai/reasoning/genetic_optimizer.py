"""
AgriTrace Multi-Objective Genetic Algorithm Optimizer (GA Optimizer v1.0)
Solves complex combinatorial batch allocations across multiple buyers, routes,
quantities, and price constraints under remaining shelf-life limits.
"""

from typing import Dict, Any, List, Optional, Tuple
import random
import numpy as np
from ai.version_registry import MODEL_VERSIONS

class AgriTraceGeneticOptimizer:
    """
    Multi-objective Genetic Algorithm for Agricultural Batch Allocation.
    Maximizes Revenue + Waste Reduction while Minimizing Spoilage + Transport Cost.
    """
    def __init__(
        self,
        population_size: int = 30,
        generations: int = 25,
        mutation_rate: float = 0.15,
        crossover_rate: float = 0.80,
        version: str = MODEL_VERSIONS["ga_optimizer"]
    ):
        self.population_size = population_size
        self.generations = generations
        self.mutation_rate = mutation_rate
        self.crossover_rate = crossover_rate
        self.version = version

    def optimize_batch_allocation(
        self,
        total_quantity_kg: float,
        remaining_shelf_life_days: float,
        current_freshness_score: float,
        candidate_buyers: List[Dict[str, Any]],
        base_market_price_per_kg: float = 28.0
    ) -> Dict[str, Any]:
        """
        Executes GA optimization to find the highest-fitness allocation plan.
        """
        if not candidate_buyers:
            return {
                "optimizer_version": self.version,
                "status": "NO_BUYERS_AVAILABLE",
                "recommended_allocation": [],
                "expected_revenue": 0.0,
                "waste_risk_percentage": 100.0 if remaining_shelf_life_days < 2.0 else 20.0
            }

        num_buyers = len(candidate_buyers)
        
        # Chromosome representation: vector of split proportions [p_0, p_1, ..., p_{N-1}] summing to 1.0
        def create_individual():
            weights = [random.uniform(0.1, 1.0) for _ in range(num_buyers)]
            total = sum(weights)
            return [w / total for w in weights]

        def calculate_fitness(individual: List[float]) -> Tuple[float, Dict[str, float]]:
            total_rev = 0.0
            total_trans_cost = 0.0
            total_spoilage_risk = 0.0
            total_allocated_kg = 0.0
            
            for i, prop in enumerate(individual):
                buyer = candidate_buyers[i]
                qty = prop * total_quantity_kg
                total_allocated_kg += qty
                
                # Check buyer capacity limit
                max_cap = buyer.get("max_capacity_kg", total_quantity_kg)
                effective_qty = min(qty, max_cap)
                overflow_penalty = (qty - effective_qty) * base_market_price_per_kg * 0.8
                
                # Buyer offered price
                offered_price = buyer.get("offered_price_per_kg", base_market_price_per_kg)
                revenue = effective_qty * offered_price
                
                # Transport cost based on distance
                dist_km = buyer.get("distance_km", 10.0)
                trans_cost = effective_qty * (0.05 * dist_km)  # ₹0.05 per kg per km
                
                # Spoilage transit risk
                transit_hours = dist_km / 35.0  # Approx 35 km/h rural transport
                transit_shelf_life_ratio = (transit_hours / 24.0) / max(0.2, remaining_shelf_life_days)
                spoil_penalty = effective_qty * offered_price * min(1.0, transit_shelf_life_ratio * 1.5)
                
                total_rev += revenue - overflow_penalty
                total_trans_cost += trans_cost
                total_spoilage_risk += spoil_penalty

            # Waste reduction bonus
            waste_reduction_bonus = total_allocated_kg * 2.5
            
            fitness = total_rev - total_trans_cost - total_spoilage_risk + waste_reduction_bonus
            metrics = {
                "revenue": max(0.0, total_rev),
                "transport_cost": total_trans_cost,
                "spoilage_penalty": total_spoilage_risk,
                "waste_bonus": waste_reduction_bonus
            }
            return fitness, metrics

        # 1. Initialize Population
        population = [create_individual() for _ in range(self.population_size)]

        # 2. Evolutionary Loop
        best_individual = population[0]
        best_fitness, best_metrics = calculate_fitness(best_individual)

        for gen in range(self.generations):
            # Evaluate all
            scores = [calculate_fitness(ind) for ind in population]
            fitness_values = [s[0] for s in scores]
            
            for idx, (f, m) in enumerate(scores):
                if f > best_fitness:
                    best_fitness = f
                    best_individual = population[idx]
                    best_metrics = m

            # Selection (Tournament)
            selected = []
            for _ in range(self.population_size):
                i1, i2 = random.randint(0, self.population_size - 1), random.randint(0, self.population_size - 1)
                selected.append(population[i1] if fitness_values[i1] > fitness_values[i2] else population[i2])

            # Crossover & Mutation
            next_pop = [best_individual]  # Elitism
            while len(next_pop) < self.population_size:
                p1, p2 = random.choice(selected), random.choice(selected)
                # Crossover
                if random.random() < self.crossover_rate:
                    cut = random.randint(1, num_buyers - 1) if num_buyers > 1 else 0
                    child = p1[:cut] + p2[cut:]
                else:
                    child = list(p1)
                
                # Mutation
                if random.random() < self.mutation_rate:
                    m_idx = random.randint(0, num_buyers - 1)
                    child[m_idx] = max(0.01, child[m_idx] + random.uniform(-0.2, 0.2))
                    
                # Normalize child weights
                tot = sum(child) + 1e-6
                child = [c / tot for c in child]
                next_pop.append(child)

            population = next_pop

        # 3. Format Optimal Allocation Plan
        allocation_plan = []
        for i, prop in enumerate(best_individual):
            qty = round(prop * total_quantity_kg, 1)
            if qty >= 1.0:  # Only include non-trivial allocations
                buyer = candidate_buyers[i]
                allocation_plan.append({
                    "buyer_id": buyer.get("id", f"buyer_{i+1}"),
                    "buyer_name": buyer.get("name", f"Buyer {chr(65+i)}"),
                    "allocated_quantity_kg": qty,
                    "offered_price_per_kg": buyer.get("offered_price_per_kg", base_market_price_per_kg),
                    "distance_km": buyer.get("distance_km", 10.0),
                    "estimated_transit_hours": round(buyer.get("distance_km", 10.0) / 35.0, 1),
                    "projected_revenue": round(qty * buyer.get("offered_price_per_kg", base_market_price_per_kg), 2)
                })

        # Sort by allocated quantity descending
        allocation_plan.sort(key=lambda x: x["allocated_quantity_kg"], reverse=True)

        return {
            "optimizer_version": self.version,
            "status": "OPTIMAL_SOLUTION_FOUND",
            "generations_run": self.generations,
            "best_fitness_score": round(best_fitness, 2),
            "expected_net_revenue": round(best_metrics["revenue"] - best_metrics["transport_cost"], 2),
            "estimated_transport_cost": round(best_metrics["transport_cost"], 2),
            "spoilage_risk_index": round(best_metrics["spoilage_penalty"] / max(1.0, best_metrics["revenue"]), 3),
            "recommended_allocation": allocation_plan,
            "explanation": (
                f"Genetic Algorithm evolved {self.generations} generations to find the optimal trade-off: "
                f"Allocated {total_quantity_kg} kg across {len(allocation_plan)} buyers with estimated net revenue "
                f"of ₹{best_metrics['revenue'] - best_metrics['transport_cost']:.2f} and minimum transit spoilage."
            )
        }

_GLOBAL_GA_OPTIMIZER = AgriTraceGeneticOptimizer()

def run_genetic_optimization(**kwargs) -> Dict[str, Any]:
    return _GLOBAL_GA_OPTIMIZER.optimize_batch_allocation(**kwargs)
