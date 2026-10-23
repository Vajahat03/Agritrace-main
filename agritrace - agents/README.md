# 🌱 AgriTrace: Autonomous Multi-Agent AI System for Agricultural Quality, Shelf-Life Prediction & Food Waste Prevention

Phase 4 of the authenticated farmer workflow (deterministic recommendations, inventory validation, and optional market data) is documented in [backend/PHASE4.md](backend/PHASE4.md). No live market feed is configured; legacy simulated agent prices are not used in farmer scan decisions.

AgriTrace is an end-to-end, production-grade autonomous multi-agent platform designed to prevent post-harvest food loss across agricultural supply chains. Built upon a **Computational Thinking Directed Acyclic Graph (DAG)**, AgriTrace coordinates 8 specialized AI agents that perceive visual produce conditions, predict remaining shelf life under dynamic microclimates, evaluate environmental risks, automate IoT storage controls, analyze commodity market pricing, rank commercial buyers, and synthesize optimal decision plans using fuzzy logic and genetic optimization.

---

## 📑 Table of Contents
1. [Multi-Agent System Architecture & DAG Workflow](#1-multi-agent-system-architecture--dag-workflow)
2. [Specialized Agents: In-Depth Workings](#2-specialized-agents-in-depth-workings)
3. [Training Datasets & Data Splits](#3-training-datasets--data-splits)
4. [Mathematical Formulations & Algorithms](#4-mathematical-formulations--algorithms)
5. [Evaluation Metrics & Accuracy Computation](#5-evaluation-metrics--accuracy-computation)
6. [Measured Empirical Performance Benchmark](#6-measured-empirical-performance-benchmark)
7. [System Manifest & Version Registry](#7-system-manifest--version-registry)
8. [Quickstart & Execution Guide](#8-quickstart--execution-guide)

---

## 1. Multi-Agent System Architecture & DAG Workflow

AgriTrace executes an autonomous multi-agent pipeline where agents communicate through a shared immutable state dictionary, producing traceable decisions backed by evidence and latency profiling.

```
                                  ┌──────────────────────────────────────────────────────────┐
                                  │                  Input Batch Payload                     │
                                  │(RGB Image, Sensor Telemetry, Quantity, Candidate Buyers) │
                                  └─────────────────────────────┬────────────────────────────┘
                                                                │
                                                                ▼
                                  ┌──────────────────────────────────────────────────────────┐
                                  │               1. Vision / Freshness Agent                │
                                  │        (DenseNet-121 Multi-Task Backbone + Grad-CAM)     │
                                  └──────────────┬───────────────────────────┬───────────────┘
                                                 │                           │
                                     [Invalid / Severe Rot]        [Valid Produce Detected]
                                                 │                           │
                                                 ▼                           ▼
                                  ┌──────────────────────┐    ┌──────────────────────────────┐
                                  │ Early Exit Rejection │    │ 2. Shelf-Life Predict Agent  │
                                  │     (OOD / Bad)      │    │  (XGBoost + Arrhenius Model) │
                                  └──────────────────────┘    └──────────────┬───────────────┘
                                                                             │
                                                                             ▼
                                                              ┌──────────────────────────────┐
                                                              │ 3. Environmental Risk Agent  │
                                                              │ (Microclimate Risk Analyzer) │
                                                              └──────────────┬───────────────┘
                                                                             │
                                                                             ▼
                                                              ┌──────────────────────────────┐
                                                              │ 4. Storage / SmartBag Agent  │
                                                              │  (IoT Actuator Controllers)  │
                                                              └──────────────┬───────────────┘
                                                                             │
                                                                             ▼
                                                              ┌──────────────────────────────┐
                                                              │ 5. Market Intelligence Agent │
                                                              │  (APMC Trends & Elasticity)  │
                                                              └──────────────┬───────────────┘
                                                                             │
                                                                             ▼
                                                              ┌──────────────────────────────┐
                                                              │   6. Buyer Matching Agent    │
                                                              │ (Multi-Criteria Score Engine)│
                                                              └──────────────┬───────────────┘
                                                                             │
                                                                             ▼
                                                              ┌──────────────────────────────┐
                                                              │      7. Logistics Agent      │
                                                              │  (Route & Safety Validation) │
                                                              └──────────────┬───────────────┘
                                                                             │
                                                                             ▼
                                                              ┌──────────────────────────────┐
                                                              │ 8. Central Decision / Plan   │
                                                              │ (Safety Rules + Fuzzy Logic  │
                                                              │    + Genetic Optimizer)      │
                                                              └──────────────┬───────────────┘
                                                                             │
                                                                             ▼
                                  ┌──────────────────────────────────────────────────────────┐
                                  │                    Final Output Plan                     │
                                  │   (Action Directives, Allocation, Spoilage Curves, Trace)│
                                  └──────────────────────────────────────────────────────────┘
```

### The Base Agent Contract (`BaseAgent`)
Every agent in the system inherits from `BaseAgent` (`agents/base_agent.py`):
```python
class BaseAgent(ABC):
    def __init__(self, name: str, goal: str, version: str): ...
    
    @abstractmethod
    def execute(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Core reasoning logic producing output, confidence, and evidence."""
        pass

    def run(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Wrapper with automatic latency profiling (ms) and audit packaging."""
```

---

## 2. Specialized Agents: In-Depth Workings

### 1. Vision / Freshness Agent (`agents/vision_agent.py`)
* **Goal**: Perceives crop identity, grades freshness stage, pinpoints defects, and generates visual explanation heatmaps.
* **Underlying Model**: `AgriTrace Vision-D121` (DenseNet-121 multi-task neural network).
* **Inputs**: RGB image tensor $(3 \times 224 \times 224)$.
* **Outputs**:
  * Produce Class (e.g., Tomato, Apple, Banana, Potato, Onion, Orange, Bell Pepper, Strawberry).
  * Freshness Grade (`fresh`, `moderately_fresh`, `overripe`, `spoiled`).
  * Quality Score ($0.0 - 100.0$).
  * Defect Classification (e.g., `minor_soft_spot`, `bruise_impact`, `fungal_speck`, `none`).
  * Grad-CAM attention heatmap overlay.
* **Early Rejection**: If an Out-of-Distribution (OOD) image or non-agricultural input is detected ($p_{\text{produce}} < 0.35$ or Mahalanobis distance exceeds threshold), the pipeline triggers an immediate safe rejection.

### 2. Shelf-Life Prediction Agent (`agents/shelf_life_agent.py`)
* **Goal**: Forecasts remaining usable commercial shelf life and temporal spoilage curves.
* **Underlying Model**: `ShelfLife-XGB v1.0` (Gradient Boosted Decision Trees + Arrhenius Thermal Respiration).
* **Inputs**: Vision quality score, defect probability, microclimate sensor telemetry (temperature, humidity), storage enclosure type, and harvest age.
* **Outputs**:
  * Point estimate of remaining shelf life (days).
  * Calibrated 90% prediction interval ($[\text{Min Days}, \text{Max Days}]$).
  * Cumulative spoilage probabilities at $24\text{h}$, $48\text{h}$, and $72\text{h}$ horizons.
  * Feature importance attribution breakdown.

### 3. Environmental / Risk Agent (`agents/risk_agent.py`)
* **Goal**: Real-time microclimate risk analysis and anomaly detection.
* **Inputs**: IoT telemetry: Temperature ($^\circ\text{C}$), Relative Humidity ($\%RH$), VOC / Ethylene gas ($\text{ppm}$).
* **Outputs**:
  * Thermal risk rating: `CRITICAL` ($T \ge 28^\circ\text{C}$), `HIGH` ($T \ge 22^\circ\text{C}$), `CHILLING_RISK` ($T < 4^\circ\text{C}$), or `OPTIMAL`.
  * Humidity hazards: Condensation/fungal hazard ($RH > 92\%$) or desiccation ($RH < 60\%$).
  * Ripening acceleration trigger: Elevated VOC/Ethylene ($> 45\text{ ppm}$).
  * Overall environmental risk index ($0.0 - 1.0$).

### 4. Storage / SmartBag Agent (`agents/storage_agent.py`)
* **Goal**: Autonomous actuation and preservation commands for IoT SmartBags and cold containers.
* **Inputs**: Microclimate risk outputs, enclosure ID, ambient state.
* **Outputs**:
  * Thermoelectric cooling cycle commands: `OFF`, `MODERATE`, `HIGH` (Target setpoint: $14.0^\circ\text{C}$).
  * Ventilation purge fan actuation: `ACTIVE` or `STANDBY`.
  * Real-time preservation mode directives.

### 5. Market Intelligence Agent (`agents/market_agent.py`)
* **Goal**: Agricultural price analytics, economic holding viability, and price trend forecasting.
* **Inputs**: Produce type, market velocity, historical APMC benchmark price indices.
* **Outputs**:
  * Current benchmark price ($\text{₹/kg}$).
  * 24-hour forward price forecast ($\text{₹/kg}$) based on trend vectors (`rising`, `stable`, `falling`).
  * Commercial recommendation (`"Sell early before price drop"` vs. `"Hold for peak return"`).

### 6. Buyer Matching Agent (`agents/buyer_agent.py`)
* **Goal**: Identify and rank candidate buyers (wholesalers, processors, retailers) using multi-criteria optimization.
* **Inputs**: Batch produce type, quality score, predicted remaining shelf life, candidate buyer pool.
* **Outputs**:
  * Ranked buyer leaderboard sorted by composite compatibility score ($0 - 100$).
  * Quality constraint compatibility validation.
  * Best matched buyer entity.

### 7. Logistics Agent (`agents/logistics_agent.py`)
* **Goal**: Validate delivery feasibility, route safety margins, and transport urgency.
* **Inputs**: Remaining shelf-life hours, candidate buyer road distances ($\text{km}$), average fleet transit speed ($35\text{ km/h}$).
* **Outputs**:
  * Route transit feasibility boolean ($\text{Transit Hours} \times 1.5 < \text{Remaining Shelf Life Hours}$).
  * Safety buffer margins (remaining hours - transit time).
  * Transport urgency classification (`CRITICAL`, `HIGH`, `MODERATE`, `LOW`).

### 8. Central Decision / Planning Agent (`agents/decision_agent.py`)
* **Goal**: Central synthesis of multi-agent intelligence into an actionable dispatch plan.
* **Underlying Engine**: `HybridDecisionEngine` (`ai/reasoning/decision_engine.py`).
* **Reasoning Components**:
  1. **Inviolable Safety Rules**: Immediate mandatory disposal/processing if spoiled; strict adherence to operator human overrides.
  2. **Mamdani Fuzzy Risk Engine**: Defuzzifies produce condition, spoilage probability, price slope, and buyer distance into an **Action Urgency Score (0–100)**.
  3. **Genetic Algorithm Optimizer**: Determines optimal multi-buyer inventory split to maximize gross revenue minus decay penalties and logistics costs.
* **Outputs**: Action directives (`SELL_NOW`, `SELL_SOON`, `TRIGGER_COOLING`, `STORE_AND_MONITOR`), quantity allocations ($\text{kg}$ per buyer), and complete reasoning trace.

---

## 3. Training Datasets & Data Splits

The vision and prediction models in AgriTrace are trained and benchmarked on genuine agricultural datasets:

### Vision Multi-Task Benchmark (`AgriTrace-Real-v1.0.0`)
Constructed from real-world post-harvest vision datasets:
1. **AgriFreshNET Benchmark**: Multi-class produce images captured across controlled and uncontrolled lighting conditions.
2. **FruitNet & Kaggle Agricultural Quality Datasets**: High-resolution RGB images of fresh, defective, and rotting fruits and vegetables.
3. **Banana & Guava Ripening Progression Datasets**: Time-series visual captures across 7 ripening stages.

#### Data Splits
| Dataset Split | Sample Count | Purpose |
|---|---|---|
| **Training Split** | **19,492 images** (80%) | Feature extraction, backpropagation, and multi-task parameter optimization |
| **Validation Split** | **2,436 images** (10%) | Hyperparameter tuning, early stopping, and Temperature Scaling calibration ($T = 0.870$) |
| **Test Split** | **4,873 images** (10% held-out) | Independent empirical evaluation (Zero data leakage) |

#### Target Classes & Label Mappings
* **Produce Classes (8 classes)**: `Apple`, `Banana`, `Bell Pepper`, `Guava`, `Onion`, `Orange`, `Potato`, `Tomato`.
* **Freshness Grades (4 classes)**: `fresh` (Index 0), `moderately_fresh` (Index 1), `overripe` (Index 2), `spoiled` (Index 3).
* **Defects (5 classes)**: `none`, `bruise_impact`, `fungal_speck`, `skin_scarring`, `minor_soft_spot`.
* **Quality Score**: Continuous target in range $[0.0, 100.0]$.

---

## 4. Mathematical Formulations & Algorithms

### 1. Vision Multi-Task Loss Function
The DenseNet-121 backbone is trained end-to-end minimizing a multi-task joint loss $\mathcal{L}_{\text{total}}$:

$$\mathcal{L}_{\text{total}} = \lambda_p \mathcal{L}_{\text{CE}}^{(p)} + \lambda_f \mathcal{L}_{\text{CE}}^{(f)} + \lambda_d \mathcal{L}_{\text{BCE}}^{(d)} + \lambda_q \mathcal{L}_{\text{Huber}}^{(q)}$$

Where:
* $\mathcal{L}_{\text{CE}}^{(p)}$: Cross-entropy loss for produce class identification:
  $$\mathcal{L}_{\text{CE}}^{(p)} = - \sum_{c=1}^{C_p} y_c \log(\hat{y}_c)$$
* $\mathcal{L}_{\text{CE}}^{(f)}$: Cross-entropy loss for 4-class freshness grading.
* $\mathcal{L}_{\text{BCE}}^{(d)}$: Binary cross-entropy for defect classification.
* $\mathcal{L}_{\text{Huber}}^{(q)}$: Smooth $L_1$ Huber loss for quality score regression:
  $$\mathcal{L}_{\text{Huber}}(y, \hat{y}) = \begin{cases} \frac{1}{2}(y - \hat{y})^2 & \text{for } |y - \hat{y}| \le \delta \\ \delta |y - \hat{y}| - \frac{1}{2}\delta^2 & \text{otherwise} \end{cases}$$
* Weighting coefficients: $\lambda_p = 1.0, \lambda_f = 1.0, \lambda_d = 0.75, \lambda_q = 0.02$.

---

### 2. Confidence Calibration via Temperature Scaling
Uncalibrated deep networks often produce overconfident probabilities. We fit a single scalar parameter $T > 0$ on the validation set log-likelihood:

$$\hat{p}_i = \frac{e^{z_i / T}}{\sum_{j=1}^K e^{z_j / T}}$$

Where $z_i$ represents raw output logits. In AgriTrace, validation fitting yielded optimal temperature $T^* = 0.870$, successfully reducing calibration error on test data.

---

### 3. Grad-CAM Visual Saliency Heatmaps
Visual attention maps explain which image regions triggered the freshness or defect classification.
1. Compute gradient of class score $y^c$ with respect to feature activation map $A^k$ of the final DenseNet convolutional layer:
   $$\alpha_k^c = \frac{1}{Z} \sum_{i=1}^U \sum_{j=1}^V \frac{\partial y^c}{\partial A_{i,j}^k}$$
2. Take the positive linear combination followed by ReLU:
   $$L_{\text{Grad-CAM}}^c = \text{ReLU}\left( \sum_k \alpha_k^c A^k \right)$$

---

### 4. Shelf-Life Estimation (Arrhenius Respiration Model)
Produce degradation accelerates non-linearly with temperature, governed by the biochemical respiration quotient ($Q_{10}$ approximation):

$$\text{Degradation Factor } \gamma_T = \begin{cases} 
\frac{1}{1 + \left(\frac{T - T_{\text{opt\_max}}}{8.0}\right)^{1.2}} & \text{if } T > T_{\text{opt\_max}} \\
\frac{1}{1 + \left(\frac{(T_{\text{opt\_min}} - T) \cdot s_{\text{chill}}}{10.0}\right)} & \text{if } T < T_{\text{opt\_min}} \\
1.0 & \text{otherwise}
\end{cases}$$

Core remaining shelf life:
$$\text{Remaining Days} = \max\left(0.1, \Big[L_{\text{base}} \cdot M_{\text{storage}} \cdot F_{\text{fresh}} \cdot P_{\text{defect}} \cdot \gamma_T \cdot \gamma_{\text{RH}}\Big] - 0.4 \cdot \text{Age}_{\text{harvest}}\right)$$

Where:
* $F_{\text{fresh}} = 0.7\left(\frac{S_{\text{fresh}}}{100}\right) + 0.3\left(\frac{S_{\text{qual}}}{100}\right)$
* $P_{\text{defect}} = 1.0 - 0.55 \cdot (p_{\text{defect}})^{1.3}$

---

### 5. Calibrated 90% Prediction Intervals
Uncertainty variance $\sigma$ scales with defect severity and temperature volatility:

$$\sigma = \hat{y} \cdot \left[ 0.12 + 0.15 \cdot p_{\text{defect}} + 0.08 \cdot (1.0 - \gamma_T) \right]$$

$$I_{90\%} = \left[ \max(0.1, \hat{y} - 1.645\sigma), \quad \hat{y} + 1.645\sigma \right]$$

---

### 6. Cumulative Logistic Spoilage Probability
The probability of total spoilage within a horizon of $t$ days ($t \in \{1, 2, 3\}$) follows a logistic degradation curve:

$$P(\text{Spoilage} \le t) = \frac{1}{1 + e^{(\hat{y} - t) \cdot k_t}}$$

Where $k_1 = 1.8, k_2 = 1.5, k_3 = 1.3$.

---

### 7. Buyer Composite Compatibility Scoring
Candidate buyers are evaluated using a multi-criteria utility function:

$$\text{Score} = \Big[ w_q Q_{\text{comp}} + w_d D_{\text{score}} + w_p \left(\frac{P_{\text{offered}}}{P_{\text{benchmark}}}\right) + w_r R_{\text{buyer}} \Big] \times U_{\text{urgency}} \times 100$$

Where:
* $w_q = 0.35, w_d = 0.25, w_p = 0.20, w_r = 0.20$
* Distance penalty: $D_{\text{score}} = \max\left(0.1, 1.0 - \frac{\text{Distance (km)}}{100}\right)$
* Urgency multiplier: $U_{\text{urgency}} = 1.2$ if remaining shelf life $\le 2.5\text{ days}$ and $\text{Distance} \le 20\text{ km}$; else $1.0$.

---

### 8. Mamdani Fuzzy Inference Engine
The decision engine evaluates 5 linguistic variables: Freshness, Shelf Life, 48h Spoilage Risk, Price Trend, and Buyer Distance.
* **Defuzzification (Centroid Method)**:
  $$z^* = \frac{\int z \cdot \mu_C(z) \, dz}{\int \mu_C(z) \, dz}$$
  Where $\mu_C(z)$ is the aggregated output membership function yielding the **Action Urgency Score** ($0 - 100$).

---

### 9. Genetic Algorithm Inventory Allocation Optimization
When multiple candidate buyers exist for a large batch ($Q_{\text{total}} \ge 50\text{ kg}$), a Genetic Algorithm optimizes the allocation vector $\mathbf{x} = [x_1, x_2, \dots, x_N]$ to maximize fitness $F(\mathbf{x})$:

$$F(\mathbf{x}) = \sum_{i=1}^N \Big( x_i \cdot P_i - \text{Penalty}_{\text{decay}}(x_i, d_i) - \text{Cost}_{\text{logistics}}(x_i, d_i) \Big) - \lambda_{\text{excess}} \left| \sum x_i - Q_{\text{total}} \right|$$

Where:
* $\text{Penalty}_{\text{decay}} = x_i \cdot P_i \cdot \left( \frac{d_i / 35.0}{\hat{y} \cdot 24.0} \right)^{1.2}$
* $\text{Cost}_{\text{logistics}} = d_i \cdot 0.08 \cdot x_i$
* Mutation: Gaussian perturbation with Dirichlet simplex normalization ensuring $\sum x_i = Q_{\text{total}}$.

---

## 5. Evaluation Metrics & Accuracy Computation

### 1. Classification Accuracy & Macro F1-Score
For $N$ evaluation samples and $K$ classes:
* **Top-1 Accuracy**:
  $$\text{Accuracy} = \frac{1}{N} \sum_{i=1}^N \mathbb{I}(y_i = \hat{y}_i) \times 100\%$$
* **Precision ($P_k$) & Recall ($R_k$) per class**:
  $$P_k = \frac{\text{TP}_k}{\text{TP}_k + \text{FP}_k}, \quad R_k = \frac{\text{TP}_k}{\text{TP}_k + \text{FN}_k}$$
* **Macro F1-Score**:
  $$F_1^{(k)} = \frac{2 \cdot P_k \cdot R_k}{P_k + R_k}, \quad \text{Macro } F_1 = \frac{1}{K} \sum_{k=1}^K F_1^{(k)}$$

---

### 2. Ordinal Mean Absolute Class Error (MACE)
Freshness grades have natural ordering ($\text{Fresh} = 0 \to \text{Spoiled} = 3$). MACE penalizes distance between predicted and ground-truth ordinal levels:

$$\text{Ordinal MACE} = \frac{1}{N} \sum_{i=1}^N \left| y_i^{(\text{ordinal})} - \hat{y}_i^{(\text{ordinal})} \right|$$

*(A prediction of "moderately fresh" when true is "fresh" has error 1; a prediction of "spoiled" has error 3).*

---

### 3. Regression Metrics (Quality Score & Shelf Life)
* **Mean Absolute Error (MAE)**:
  $$\text{MAE} = \frac{1}{N} \sum_{i=1}^N |y_i - \hat{y}_i|$$
* **Root Mean Squared Error (RMSE)**:
  $$\text{RMSE} = \sqrt{\frac{1}{N} \sum_{i=1}^N (y_i - \hat{y}_i)^2}$$
* **Coefficient of Determination ($R^2$)**:
  $$R^2 = 1 - \frac{\sum_{i=1}^N (y_i - \hat{y}_i)^2}{\sum_{i=1}^N (y_i - \bar{y})^2}$$

---

### 4. Expected Calibration Error (ECE)
Predictions are grouped into $M = 10$ equally spaced confidence bins $B_m \subset (0, 1]$:

$$\text{ECE} = \sum_{m=1}^M \frac{|B_m|}{N} \left| \text{acc}(B_m) - \text{conf}(B_m) \right|$$

Where $\text{acc}(B_m) = \frac{1}{|B_m|} \sum_{i \in B_m} \mathbb{I}(y_i = \hat{y}_i)$ and $\text{conf}(B_m) = \frac{1}{|B_m|} \sum_{i \in B_m} \hat{p}_i$.

---

### 5. Out-of-Distribution (OOD) AUROC
Calculates the Area Under the Receiver Operating Characteristic curve distinguishing in-distribution produce embeddings from non-produce outlier inputs using Energy/Maximum Softmax Scoring:

$$\text{AUROC} = \int_0^1 \text{TPR}(\text{FPR}^{-1}(u)) \, du$$

---

## 6. Measured Empirical Performance Benchmark

All metrics below are measured on the **held-out 4,873 sample test split** (`models/registry.json`):

| Evaluation Dimension        | Metric                        | Measured Test Result | Target Benchmark | Status       |
|-----------------------------|-------------------------------|----------------------|------------------|------------- |
| **Produce Recognition**     | Top-1 Accuracy                | **96.12%**           | $> 90.0\%$       | ✅ Exceeded |
| **Produce Recognition**     | Macro F1-Score                | **0.956**            | $> 0.900$        | ✅ Exceeded |
| **Freshness Grading**       | 4-Class Accuracy              | **91.76%**           | $> 88.0\%$       | ✅ Exceeded |
| **Freshness Grading**       | Macro F1-Score                | **0.865**            | $> 0.850$        | ✅ Exceeded |
| **Freshness Grading**       | Ordinal MACE                  | **0.140 classes**    | $< 0.250$        | ✅ Exceeded |
| **Quality Regression**      | Mean Absolute Error (MAE)     | **7.17 / 100**       | $< 10.0$         | ✅ Exceeded |
| **Quality Regression**      | Root Mean Squared Error (RMSE)| **11.48**            | $< 15.0$         | ✅ Exceeded |
| **Quality Regression**      | $R^2$ Score                   | **0.866**            | $> 0.800$        | ✅ Exceeded |
| **Defect Detection**        | Defect Subset Accuracy        | **100.0%**           | $> 95.0\%$       | ✅ Exceeded |
| **Probability Calibration** | Calibrated ECE ($T=0.870$)    | **0.0165**           | $< 0.050$        | ✅ Exceeded |
| **Environmental Robustness**| Gaussian Blur Accuracy        | **93.3%**            | $> 85.0\%$       | ✅ Robust   |
| **Environmental Robustness**| Low Brightness Accuracy       | **96.7%**            | $> 85.0\%$       | ✅ Robust   |
| **Environmental Robustness**| Low Contrast Accuracy         | **96.7%**            | $> 85.0\%$       | ✅ Robust   |

---

## 7. System Manifest & Version Registry

AgriTrace guarantees model provenance with zero third-party closed API inference dependencies (`ai/version_registry.py`):

| Component / Subsystem            | Engine Identifier    | Version                      | Architecture / Methodology                     |
|----------------------------------|----------------------|------------------------------|------------------------------------------------|
| **Vision Perception**            | `vision_model`       | `AgriTrace Vision-D121 v1.0` | DenseNet-121 Multi-Task CNN                    |
| **Out-of-Distribution Detector** | `ood_detector`       | `OOD Detector v1.0`          | Deep Feature Mahalanobis / Softmax Energy      |
| **Shelf-Life Prediction**        | `shelf_life_model`   | `ShelfLife-XGB v1.0`         | Gradient Boosted Trees + Arrhenius Respiration |
| **Environmental Risk**           | `risk_engine`        | `Fuzzy Risk Engine v1.0`     | Multi-threshold Sensor Anomaly Engine          |
| **Storage Automation**           | `smartbag_controller`| `SmartBag Controller v1.0`   | Active Thermoelectric / Purge Logic            |
| **Buyer & Logistics Strategy**   | `decision_policy`    | `Decision Policy v1.0`       | Multi-Criteria Utility & Transit Safety Margin |
| **Inventory Split Optimizer**    | `ga_optimizer`       | `GA Optimizer v1.0`          | Genetic Algorithm (Elitism + Dirichlet Mutation)|
| **NLP & Decision Reasoning**     | `nlp_engine`         | `AgriTrace NLP/RAG v1.0`     | Explainability Trace Synthesizer               |

---

## 8. Quickstart & Execution Guide

### Prerequisites
* Python 3.9+
* PyTorch 2.0+, XGBoost, Scikit-Learn, NumPy, Pillow

```bash
# Clone the repository
git clone https://github.com/agritrace/agritrace-agents.git
cd "agritrace - agents"

# Install dependencies
pip install torch torchvision torchaudio xgboost scikit-learn numpy pandas pillow
```

### Running the End-to-End Orchestrator

```python
from agents.orchestrator.orchestrator import orchestrate_batch
from PIL import Image

# 1. Load produce image (or pass None for simulated perception)
img = Image.open("data/sample_tomato.jpg") if False else None

# 2. Execute the autonomous multi-agent pipeline
result = orchestrate_batch(
    batch_id="BATCH-TOMATO-884",
    image=img,
    produce_type="tomato",
    quantity_kg=750.0,
    telemetry={
        "temperature_c": 24.5,
        "humidity_rh": 82.0,
        "gas_voc_ppm": 18.0,
        "storage_type": "ambient"
    },
    market_trend="falling",
    candidate_buyers=[
        {"id": "b1", "name": "Kisan Fresh Retail Hub", "distance_km": 14.0, "offered_price_per_kg": 34.0, "min_quality": 65.0, "reliability": 0.95, "max_capacity_kg": 400},
        {"id": "b2", "name": "Sahyadri Puree Processors", "distance_km": 22.0, "offered_price_per_kg": 29.0, "min_quality": 40.0, "reliability": 0.98, "max_capacity_kg": 1000},
        {"id": "b3", "name": "Apex City Wholesaler", "distance_km": 48.0, "offered_price_per_kg": 36.0, "min_quality": 75.0, "reliability": 0.88, "max_capacity_kg": 500}
    ]
)

# 3. Inspect Formulated Action Directives & Trace
print("Action Directives:", result["action_summary"])
print("Urgency Level:    ", result["urgency"])
print("Timing Window:    ", result["timing_window"])
print("Allocation Plan:  ", result["allocation_plan"])
print("Execution Latency:", result["total_duration_ms"], "ms")
```

### Running Test Suite & Model Evaluation
```bash
# Run multi-task vision evaluation on held-out test split
python -m ai.vision.evaluate

# Run unit tests across all agents
pytest tests/
```

---

## 📜 License & Compliance
AgriTrace is distributed under the Apache-2.0 License. All AI components comply with Zero Third-Party Cloud Dependency constraints, executing 100% on self-hosted infrastructure.
