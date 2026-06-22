---
permalink: /blogs/RLVR_Handbook/
title: "RLVR 基础与 Slime 框架解读"
layout: single
author_profile: true
---

# RLVR 实战手册 — 从强化学习理论到 Slime 框架

> 本手册面向有深度学习基础但未接触过强化学习的读者，从 RL 理论（只关注当前火热的RLVR）基础讲起，逐步过渡到 LLM 强化学习训练框架 Slime 的实战使用。

---

## 第一部分：强化学习理论基础

### 1.1 什么是强化学习

强化学习（Reinforcement Learning, RL）的核心设定：

- **Agent（智能体）**：做决策的主体（在 LLM 场景中就是语言模型）
- **Environment（环境）**：Agent 交互的对象（在 LLM 场景中是用户的 prompt + 评判标准）
- **State（状态）**：当前的情境（已生成的 token 序列）
- **Action（动作）**：Agent 的选择（生成下一个 token）
- **Reward（奖励）**：环境对 Agent 行为的反馈（比如回答是否正确）

**RL 的目标**：找到一个策略（Policy），使得在各种状态下采取的行动能获得最大的期望累积奖励。

**与监督学习的本质区别**：

| | 监督学习（SFT） | 强化学习（RL） |
|--|----------------|---------------|
| 信号 | 明确的"正确答案" | 只有"好坏程度"的标量反馈 |
| 学习方式 | 模仿正确答案 | 试错 + 强化好的行为 |
| Loss | `-log P(正确token)` | `-advantage × log P(采样token)` |

---

### 1.2 基本符号定义

| 符号 | 名称 | 含义 |
|------|------|------|
| $G_t$ | Return | 从时间 t 开始，**这一次具体轨迹**上获得的累积奖励 |
| $Q(s,a)$ | Action-Value | 在状态 s 下执行动作 a，**期望**能获得的累积奖励。这个代表当前状态下执行动作a的价值 |
| $V(s)$ | State-Value | 在状态 s 下，按当前策略行动，**期望**能获得的累积奖励。这个代表当前状态的价值 |
| $A(s,a)$ | Advantage | 在状态 s 下，动作 a 比"平均水平"好多少 |

**关系**：

$$
Q(s,a) = \mathbb{E}[G_t \mid s_t=s, a_t=a]    \quad \text{Q 是 G 的期望}
$$

$$
V(s) = \mathbb{E}_a[Q(s,a)]                    \quad \text{V 是 Q 对所有动作的期望}
$$

$$
A(s,a) = Q(s,a) - V(s)                          \quad \text{Advantage = 比平均好多少}
$$

**三者的层次关系**：
- G：一次具体实验的回报（随机变量，方差大）
- Q：固定 (s,a) 后，对未来不确定性求期望（比 G 稳定）
- V：固定 s 后，对动作和未来都求期望（最稳定）

---

### 1.3 Policy Gradient

#### 核心思想

用当前策略采样轨迹，根据奖励的好坏来调整策略：
- 奖励高的轨迹 → 增加其中动作的概率
- 奖励低的轨迹 → 降低其中动作的概率

> 在优化的时候，我们优化的是 policy 的参数 $\theta$，它改变的是 $P(a\mid s)$，即一个状态下模型该有什么行为。如果在 s 下做 a 可以得到 reward，那我们应该提高 $P(a\mid s)$ 的概率，而不是优化外部的 reward。

#### 梯度公式推导

**Step 1：定义目标函数**

我们的目标是最大化 expected reward：

$$
J(\theta) = \mathbb{E}_{\tau \sim \pi_\theta}[R(\tau)] = \sum_\tau P(\tau\mid\theta) \times R(\tau)
$$

其中 $\tau$ 是一条完整轨迹 $(s_1,a_1,r_1,s_2,a_2,r_2,...)$，$P(\tau\mid\theta)$ 是在策略 $\pi_\theta$ 下这条轨迹出现的概率。

**Step 2：求梯度**

$$
\nabla J(\theta) = \sum_\tau \nabla P(\tau\mid\theta) \times R(\tau)
$$

$$
= \sum_\tau P(\tau\mid\theta) \times \nabla \log P(\tau\mid\theta) \times R(\tau) \quad \text{利用 } \nabla f = f \times \nabla \log f
$$

$$
= \mathbb{E}_{\tau \sim \pi_\theta} [ \nabla \log P(\tau\mid\theta) \times R(\tau) ]
$$

**Step 3：展开轨迹概率**

一条轨迹的概率：

$$
P(\tau\mid\theta) = P(s_1) \times \pi_\theta(a_1\mid s_1) \times P(s_2\mid s_1,a_1) \times \pi_\theta(a_2\mid s_2) \times \cdots
$$

取 log 后：

$$
\log P(\tau\mid\theta) = \log P(s_1) + \sum_t \left[ \log \pi_\theta(a_t\mid s_t) + \log P(s_{t+1}\mid s_t,a_t) \right]
$$

求导时，环境转移概率 $P(s_{t+1}\mid s_t,a_t)$ 和初始状态 $P(s_1)$ 与 $\theta$ 无关，梯度为 0：

$$
\nabla \log P(\tau\mid\theta) = \sum_t \nabla \log \pi_\theta(a_t\mid s_t)
$$

**最终得到轨迹级 Policy Gradient**：

$$
\nabla J(\theta) = \mathbb{E}_{\tau \sim \pi_\theta} \left[ \sum_t \nabla \log \pi_\theta(a_t\mid s_t) \times R(\tau) \right]
$$

> 注意：求期望时天然要求是 on-policy（从 $\pi_\theta$ 中采样），因为公式中的期望是对 $\pi_\theta$ 的分布求的。

#### 从轨迹级到 (s,a) 级

上面的公式中，所有 token 共享同一个轨迹 reward R(τ)，这太粗糙了。我们可以进一步细化。

**Step 1：将 R 拆分为过去和未来**

对于时刻 t 的动作 $a_t$，把总 reward 拆成 $R_{<t}$（过去的）和 $G_t$（未来的）：

$$
R(\tau) = R_{<t} + G_t
$$

**Step 2：证明过去的 reward 对梯度无贡献**

我们要证明：

$$
\mathbb{E}_\tau [ \nabla \log \pi_\theta(a_t\mid s_t) \times R_{<t} ] = 0
$$

**直觉**：t 时刻之前的 reward 已经发生了，和 t 时刻选择什么动作无关。无论 policy 在 t 时刻做什么选择，都不影响之前的收益，因此不该影响 policy 的梯度。

**严格证明**：

将轨迹期望按时间拆分。对于 t 时刻之前的 reward r_k（k < t），考虑：

$$
\mathbb{E}_\tau [ \nabla \log \pi_\theta(a_t\mid s_t) \times r_k ]
$$

关键观察：$r_k$ 只依赖于 $(s_k, a_k, s_{k+1})$，即 t 时刻之前的历史。而 $\nabla \log \pi_\theta(a_t\mid s_t)$ 依赖于 $(s_t, a_t)$。

将期望按条件分解——先对 t 时刻及之后的变量求期望，再对之前的变量求期望：

$$
\mathbb{E}_\tau [ \nabla \log \pi_\theta(a_t\mid s_t) \times r_k ]
= \mathbb{E}_{\tau_{<t}} \left[ r_k \times \mathbb{E}_{a_t\mid s_t} [ \nabla \log \pi_\theta(a_t\mid s_t) ] \right]
$$

其中内层期望为：

$$
\mathbb{E}_{a_t \sim \pi_\theta(\cdot\mid s_t)} [ \nabla \log \pi_\theta(a_t\mid s_t) ]
$$

$$
= \sum_a \pi_\theta(a\mid s_t) \times \nabla \log \pi_\theta(a\mid s_t)
$$

$$
= \sum_a \pi_\theta(a\mid s_t) \times \frac{\nabla \pi_\theta(a\mid s_t)}{\pi_\theta(a\mid s_t)}
$$

$$
= \sum_a \nabla \pi_\theta(a\mid s_t) = \nabla \sum_a \pi_\theta(a\mid s_t) = \nabla 1 = 0
$$

**核心引理**：$\mathbb{E}_{a \sim \pi}[\nabla \log \pi(a\mid s)] = 0$，即 score function 的期望恒为零。这是因为概率分布归一化（所有概率之和为 1，其梯度为 0）。

因此，无论 $r_k$ 取什么值，整个表达式都等于 0。对所有 $k < t$ 的 $r_k$ 求和仍为 0：

$$
\mathbb{E}_\tau [ \nabla \log \pi_\theta(a_t\mid s_t) \times R_{<t} ] = \sum_{k<t} \mathbb{E}_\tau [ \nabla \log \pi_\theta(a_t\mid s_t) \times r_k ] = 0
$$

> **推论**：任何只依赖于 $s_t$（而不依赖 $a_t$）的函数 $b(s_t)$ 都满足 $\mathbb{E}[\nabla \log \pi(a_t\mid s_t) \times b(s_t)] = 0$。这就是为什么 baseline $V(s)$ 不影响梯度期望——它和 $R_{<t}$ 一样，与 $a_t$ 的选择无关。

**Step 3：用 Q 替换 G**

对于相同的 (s_t, a_t)，不同轨迹会给出不同的 G_t（因为后续的随机性）。如果采样不够多，G_t 的估计会很不稳定。

**命题**：用 $Q(s_t, a_t) = \mathbb{E}[G_t \mid s_t, a_t]$ 替换 $G_t$ 不影响梯度的期望。

**证明**：

经过 Step 2，我们已经得到：

$$
\nabla J(\theta) = \mathbb{E}_\tau \left[ \sum_t \nabla \log \pi_\theta(a_t\mid s_t) \times G_t \right]
$$

对于每个时刻 t，考虑单项：

$$
\mathbb{E}_\tau [ \nabla \log \pi_\theta(a_t\mid s_t) \times G_t ]
$$

利用条件期望的 tower property（全期望公式）：先对 $(s_t, a_t)$ 条件化，再对 $(s_t, a_t)$ 求期望：

$$
= \mathbb{E}_{s_t, a_t} \left[ \nabla \log \pi_\theta(a_t\mid s_t) \times \mathbb{E}[G_t \mid s_t, a_t] \right]
$$

这一步的关键在于：$\nabla \log \pi_\theta(a_t\mid s_t)$ 在给定 $(s_t, a_t)$ 后是确定值（不再是随机变量），可以提到内层条件期望外面。而 $\mathbb{E}[G_t \mid s_t, a_t]$ 正是 $Q^\pi(s_t, a_t)$ 的定义。因此：

$$
= \mathbb{E}_{s_t, a_t} \left[ \nabla \log \pi_\theta(a_t\mid s_t) \times Q^\pi(s_t, a_t) \right]
$$

反过来，从 Q 出发也可以还原回 G：

$$
\mathbb{E}_{s_t, a_t} \left[ \nabla \log \pi_\theta(a_t\mid s_t) \times Q^\pi(s_t, a_t) \right] = \mathbb{E}_\tau [ \nabla \log \pi_\theta(a_t\mid s_t) \times G_t ] \quad \text{tower property 反向}
$$

两者相等，证毕。

> **直觉**：$G_t$ 是 $Q(s_t, a_t)$ 的一个无偏采样（一次 Monte Carlo 估计）。用期望值 Q 替换单次采样 G，不改变梯度的期望方向，但大幅降低方差——因为 Q 消除了 $(s_t, a_t)$ 之后所有随机性带来的噪声。

**最终得到 (s,a) 级 Policy Gradient**：

$$
\nabla J(\theta) = \mathbb{E}_{s,a \sim \pi_\theta} \left[ \sum_t \nabla \log \pi_\theta(a_t\mid s_t) \times Q^\pi(s_t, a_t) \right]
$$

**Step 4：用 A 替换 Q**

**命题**：把 $Q(s_t, a_t)$ 换成 $A(s_t, a_t) = Q(s_t, a_t) - V(s_t)$ 不影响梯度期望。

**证明**：

只需证明减去 $V(s_t)$ 不影响梯度，即证：

$$
\mathbb{E}_{s_t, a_t \sim \pi_\theta} [ \nabla \log \pi_\theta(a_t\mid s_t) \times V(s_t) ] = 0
$$

将期望拆分为先对 $a_t$ 求期望，再对 $s_t$ 求期望：

$$
= \mathbb{E}_{s_t} \left[ V(s_t) \times \mathbb{E}_{a_t \sim \pi_\theta(\cdot\mid s_t)} [ \nabla \log \pi_\theta(a_t\mid s_t) ] \right]
$$

$V(s_t)$ 不依赖 $a_t$，可以提到内层期望外面。而内层期望正是 Step 2 中证明过的 score function 期望：

$$
\mathbb{E}_{a_t \sim \pi_\theta(\cdot\mid s_t)} [ \nabla \log \pi_\theta(a_t\mid s_t) ] = 0 \quad \text{Score function 引理}
$$

因此整个表达式为 0，证毕。

> **本质**：$V(s_t)$ 只依赖状态不依赖动作，它是一个合法的 baseline。减去 baseline 不改变梯度期望，但将信号从"绝对好坏"变成"比平均好多少"，方差大幅下降。

**最终的 Policy Gradient 公式**：

$$
\nabla J(\theta) = \mathbb{E}_{s,a \sim \pi_\theta} \left[ \sum_t \nabla \log \pi_\theta(a_t\mid s_t) \times A^\pi(s_t, a_t) \right]
$$

这就是最终的 Policy Gradient 公式。从"绝对好坏"变成了"比平均好多少"，方差大幅下降。

#### 三个关键改进

**改进 1：Add Baseline**

问题：如果所有轨迹的 reward 都是正的，所有动作的概率都会增加。理论上没问题（增加幅度不同），但实际采样有限时，未被采样到的动作概率会被迫下降（因为所有概率之和为 1）。

解决：减去一个 baseline b（通常是 reward 的均值），这同时也有降低方差的作用：

$$
\nabla J(\theta) = \mathbb{E}[ \nabla \log \pi(a\mid s) \times (R - b) ]
$$

**改进 2：Assign Credit**

问题：整条轨迹的奖励不能反映每个动作的贡献。在语言模型中，就是对一个 sequence 的不同 token 应该有不同的 reward。

解决：每个动作只考虑它之后的累积奖励：

$$
\nabla J(\theta) = \mathbb{E}\left[ \sum_t \nabla \log \pi(a_t\mid s_t) \times G_t \right]
$$

其中 $G_t = r_t + r_{t+1} + \cdots$ 是从 t 时刻开始的未来回报。

**改进 3：Reward Decay**

问题：很远之后的奖励可能和当前动作关系不大。比如 100 步后的某个 reward 可能受当前 action 的影响已经很小了。

解决：加入折扣因子 $\gamma$：

$$
G_t = r_t + \gamma \cdot r_{t+1} + \gamma^2 \cdot r_{t+2} + \cdots
$$

> **在强化学习中，一个很重要的点就是：如何通过有限的采样估计准 reward。** 上面的每一步改进都是在降低估计的方差，使得有限采样下的训练更稳定。

---

### 1.4 从 On-policy 到 Off-policy

#### On-policy vs Off-policy

- **On-policy**：用于采样的模型 = 正在训练的模型。每次更新后必须重新采样。
- **Off-policy**：用旧模型采样的数据来更新新模型。数据可以复用多次。

在 LLM 中：rollout 生成 response 的模型和实际更新参数的模型是否是同一个。

我们希望能用 off-policy 的策略，因为采样训练数据特别耗费时间（需要做完整的推理），如果只能用于更新一次就太浪费了。

#### Importance Sampling

**核心思想**：当我们很难直接从目标分布 p 中采样（比如 p 是更新后的模型，还不存在），但可以从另一个分布 q 中采样时，通过重要性权重来纠正。

$$
\mathbb{E}_p[f(x)] = \mathbb{E}_q\left[f(x) \times \frac{p(x)}{q(x)}\right]
$$

其中 $\frac{p(x)}{q(x)}$ 就是 importance weight（重要性权重）。两个式子的期望是相同的（无偏）。

#### Importance Sampling 的方差问题

虽然期望相同，但**方差可能差异巨大**：

- 如果 p 和 q 的分布差异比较大，利用 q 采样出来的结果方差会比直接从 p 采样大得多
- 如果能采样足够多次，两者的估计会趋于一致
- 但如果采样次数不够多，由于方差差异大，估计结果可能很不准确

**根本原因**：公式推导时都是按期望来分析的，但实际中我们没法算期望，而是通过采样来估计期望。采样受方差影响很大，方差大的采样就不稳定。

#### 应用到 Policy Gradient

将 on-policy 的梯度公式改写为 off-policy：

$$
\nabla J(\theta) = \mathbb{E}_{\tau \sim \pi_{old}} \left[ \frac{\pi_\theta(a\mid s)}{\pi_{old}(a\mid s)} \times \nabla \log \pi_\theta(a\mid s) \times A(s,a) \right]
$$

从梯度推导出优化目标（对 $\nabla \log \pi$ 积分）：

$$
J(\theta) = \mathbb{E}_{s \sim \pi_{old}, a \sim \pi_{old}} \left[ \frac{\pi_\theta(a\mid s)}{\pi_{old}(a\mid s)} \times A(s,a) \right]
$$

这里用了两个近似（因为工程上算不出来精确值）：
1. **新的优势 → 旧的优势**：用旧策略计算的 A 替代新策略的 A
2. **新策略的状态分布 → 旧策略的状态分布**：假设新旧策略很接近，状态分布差不多

> 求导的时候只对新策略的 $P(a\mid s)$ 求导，其他的（旧策略相关的部分）都相当于常数。

**现在的问题**：如果新旧策略对 $P(a\mid s)$ 的概率差得多，importance weight 会很大或很小，导致更新幅度不可控，策略崩溃。这就引出了 PPO。

---

### 1.5 PPO（Proximal Policy Optimization）

#### 动机

Off-policy 训练中，如果新旧策略差异太大，importance sampling 的估计会不准确，导致训练崩溃。PPO 通过限制更新幅度来解决这个问题。

#### PPO 的优化目标

从最大化 reward 的角度：

$$
J_{PPO} = \mathbb{E}\left[ \min\left(\text{ratio} \times A, \; \text{clip}(\text{ratio}, 1-\varepsilon, 1+\varepsilon) \times A\right) \right]
$$

其中：
- $\text{ratio} = \frac{\pi_{new}(a\mid s)}{\pi_{old}(a\mid s)}$ — 新旧策略的概率比
- $A$ — Advantage（当前动作比平均好多少）
- $\varepsilon$ — clip 参数（通常 0.2）

#### 为什么取 min（悲观估计）

取 min 是为了**保守更新**。我们来分两种情况分析：

**情况 1：A > 0（好动作，应该增加概率）**

| ratio | 无 clip | clip 后 | min |
|-------|---------|---------|-----|
| 1.0 | 2.0 | 2.0 | 2.0 |
| 1.1 | 2.2 | 2.2 | 2.2 |
| 1.5 | 3.0 | 2.4 | **2.4** ← clip 生效 |
| 2.0 | 4.0 | 2.4 | **2.4** ← clip 生效 |

当 ratio > 1+ε 时，clip 后的值更小，min 选择 clip 后的值。
效果：即使模型已经大幅增加了这个动作的概率，也不会获得更多的"奖励信号"，梯度为 0，停止继续增加。

**情况 2：A < 0（差动作，应该降低概率）**

| ratio | 无 clip | clip 后 | min |
|-------|---------|---------|-----|
| 1.0 | -2.0 | -2.0 | -2.0 |
| 0.9 | -1.8 | -1.8 | -1.8 |
| 0.5 | -1.0 | -1.6 | **-1.6** ← clip 生效 |

当 ratio < 1-ε 时，无 clip 的值更大（更接近 0），min 选择 clip 后的值（更负）。
效果：即使模型已经大幅降低了这个动作的概率，仍然会继续受到惩罚。

**总结**：clip 的作用是"好动作不要过度奖励，差动作可以继续惩罚"，整体是保守的。

#### 只有 clip 没有 min 会有什么问题

如果不取 min，只做 clip：
- **A > 0，ratio 很小**（当前 policy 输出该 token 的概率远小于 old policy）：clip 会让梯度为 0，忽视该 token。但这是不合理的——我们应该提高新 policy 下该 token 的输出概率。
- **A < 0，ratio 很大**（当前 policy 输出该 token 的概率远大于 old policy）：clip 也会导致梯度为 0。但这时候我们应该降低新 policy 下该 token 的输出概率。

取 min 解决了这个问题：它只在"更新方向正确但幅度过大"时才 clip，不会在"更新方向正确但还不够"时阻止更新。

#### 转换为 Loss（代码中的形式）

由于深度学习框架是最小化 loss，所以：

$$
\text{loss} = -J_{PPO} = \max(-\text{ratio} \times A, \; -\text{clip}(\text{ratio}) \times A)
$$

这就是代码中 `torch.maximum` 的来源：

```python
pg_losses1 = -ratio * advantages           # 无 clip
pg_losses2 = -clip(ratio) * advantages      # 有 clip
pg_loss = torch.maximum(pg_losses1, pg_losses2)  # 取较大者（因为加了负号）
```

#### Clip vs KL 约束

| | Clip | KL Loss |
|--|------|---------|
| 约束对象 | 当前模型 vs 采样模型（$\pi_{new}$ vs $\pi_{old}$） | 当前模型 vs 原始模型（$\pi_{new}$ vs $\pi_{ref}$） |
| 作用 | 防止单步更新太大 | 防止累积偏移太远 |
| 类比 | "每一步不能走太远" | "不能离家太远" |

两者互补：没有 KL 只有 clip，模型可能每步都走得很小，但一直往错误方向走。

---

### 1.6 Actor-Critic 框架

#### 为什么需要 Critic

在 Policy Gradient 中，我们用 G（实际轨迹的回报）来估计每个动作的好坏。但 G 的问题是：
- 对于相同的 (s, a)，不同轨迹会给出不同的 G
- 方差很大，需要大量采样才能估计准确

**解决方案**：训练一个 Critic 模型来估计 V(s)，用 V 来替代 G 中的不确定部分。

> 疑问：V 不也是需要根据采样得到的样本来估计吗？V 的方差不应该也很大吗？
> 
> 回答：Critic 通过 TD 学习（自举），引入适量的偏差来大幅降低方差，降低对长轨迹数据的需求。而且 Critic 是一个参数化的函数，可以泛化到未见过的状态。

#### V function 和 Q function

注意：V 和 Q 和具体的采样轨迹无关，它们是期望值。

- **V(s)**：在确定的 policy $\pi$ 下，遇到状态 s 之后的**期望**收益
- **Q(s,a)**：在确定的 policy $\pi$ 下，在状态 s 下采取行动 a 之后的**期望**收益

#### 用 V 替代 Q（只估计一个函数）

$Q(s,a)$ 需要输入状态和动作，在连续动作空间中学习准确的 Q 比学习 V 难得多。我们可以用 V 来表达 Q：

$$
Q(s_t, a_t) = \mathbb{E}[r_t + \gamma \cdot V(s_{t+1})]
$$

因此 Advantage 可以写成：

$$
A(s_t, a_t) = Q(s_t, a_t) - V(s_t) \approx r_t + \gamma \cdot V(s_{t+1}) - V(s_t) \quad \text{用单个样本近似期望}
$$

> 为什么在确定的 s 下，执行动作 a 后 reward 以及跳转到的 s_{t+1} 可能是随机的？
> 
> 例子：比如 a 是"攻击"，但可能带来普通攻击或暴击，reward 不同，下一个状态也不同。在 LLM 中，环境通常是确定的（给定 response 后 reward 是确定的），所以这个近似是精确的。

#### Advantage 的估计

$$
A(s_t, a_t) \approx r_t + \gamma \cdot V(s_{t+1}) - V(s_t)
$$

这就是 **TD Error**（时序差分误差）：
- $r_t$：实际获得的即时奖励（真实的）
- $\gamma \cdot V(s_{t+1})$：Critic 对未来的估计
- $V(s_t)$：Critic 对当前状态的估计

**直觉**：如果实际获得的奖励 + 未来估计 > 当前估计，说明这个动作比预期好（正的 advantage）。

> 尽管理论上把 E(r) 变成 r 并不严格（有偏估计），但相比于原来的 G，r 的方差更小，利用采样的样本估计更准确。

---

### 1.7 GAE（Generalized Advantage Estimation）

#### TD（时序差分学习）

通过 TD 来估计状态或动作的价值。利用贝尔曼方程的递归性，将长期回报分解为即时奖励和后续状态的估计值。

**TD Error**：

$$
\delta_t = r_t + \gamma \cdot V(s_{t+1}) - V(s_t)
$$

其中 $r$ 是当前这一步的真实 reward，$V$ 是 Critic 估计的。

如果我们依赖蒙特卡洛从真实的采样中计算 V，对 policy model 来说目标是无偏的，但需要考虑整个轨迹，方差大。现在用 Critic 估计的 Value，引入了偏差但降低了方差。

> 有趣的一点：上面这种一步 TD 对 advantage 本身是有偏的（V 估计不准），但在 policy gradient 上是无偏的。因为 V 只和 state 有关，和 policy 的策略无关，在求梯度时 V 这一项会变成 0。而如果用 G - V（蒙特卡洛），即使 V 估计不准，梯度也是无偏的。

#### TD 的偏差-方差权衡

- **蒙特卡洛估计**（用完整轨迹的 G）：无偏差，但方差大
- **单步 TD**（只用一步的 r + V）：方差小，但有偏差（因为 V 不准）
- **n 步 TD**：用 n 步的真实 reward + V，在偏差和方差之间权衡

用几步的 TD 取决于我们想在方差和偏差之间做什么 trade-off。

#### GAE 的思想

GAE 是通过具体的轨迹样本估计期望的方式，把具体轨迹样本的奖励和模型的期望预测进行了加权融合。

#### GAE 的递推公式

$$
\delta_t = r_t + \gamma \cdot V(s_{t+1}) - V(s_t) \quad \text{单步 TD Error}
$$

$$
A_t = \delta_t + \gamma\lambda \cdot \delta_{t+1} + (\gamma\lambda)^2 \cdot \delta_{t+2} + \cdots \quad \text{加权求和}
$$

递推形式（代码中使用）：

$$
A_t = \delta_t + \gamma\lambda \cdot A_{t+1}
$$

代表当前的即时"惊喜"和经过衰减的未来所有"惊喜"的总和。

#### λ 参数的含义

- $\lambda = 0$：只用单步 TD，$A_t = \delta_t$。方差最小，偏差最大。越依赖模型已有的期望评估（偏差大，方差小），因为模型估计比较稳定但可能不准。
- $\lambda = 1$：等价于蒙特卡洛，$A_t = G_t - V(s_t)$。无偏差，方差最大。越依赖具体的轨迹（偏差小，方差大）。
- $0 < \lambda < 1$：在偏差和方差之间权衡。

#### LLM 中的 reward 结构与 GAE 的作用

在理解 GAE 为什么重要之前，必须先搞清楚 LLM RL 中 **每个 token 的 reward $r_t$ 到底是什么**。

**核心问题**：真实 reward 只有 response 级别的评分（如数学题是否答对），只在最后一个 token 给出。那中间 token 的 $r_t$ 从哪来？

在 PPO 中，per-token reward 是这样构建的：

| token 位置 | $r_t$ 的值 | 含义 |
|-----------|-----------|------|
| 非最后 token | $-k\_\text{coef} \times \text{KL}(\pi_{\text{new}} \| \pi_{\text{ref}})$ | 只有 KL 惩罚，没有真实 reward |
| 最后一个 token | $-k\_\text{coef} \times \text{KL} + \text{response\_reward}$ | KL 惩罚 + RM 给的真实评分 |

```python
# PPO 中构建 token-level reward
rewards[i, t] = -kl_coef * kl[i, t]                    # 每个 token 都惩罚偏离 ref
rewards[i, last_token] += response_level_reward[i]      # 最后一个 token 加上 RM 奖励
```

> **这就是 PPO 把 KL 放在 reward 里的具体含义**：每个 token 的 $r_t$ 不是 0，而是 KL 惩罚。GRPO 不同——它不在 reward 里做 KL，而是把 KL 放到总 loss 里。

**GAE 的作用：让稀疏的 final reward 传播到所有 token**

如果只用单步 TD（$\lambda = 0$），advantage 只依赖当前 token 的 $r_t$：
- 最后一个 token：$A_{T-1} = r_{T-1} + \gamma V(s_T) - V(s_{T-1})$，包含真实 reward ✓
- 倒数第二个 token：$A_{T-2} = r_{T-2} + \gamma V(s_{T-1}) - V(s_{T-2})$，只有 KL 惩罚，真实 reward 只能通过 $V(s_{T-1})$ 间接影响
- 更前面的 token：真实 reward 的影响更弱

用 GAE（$\lambda > 0$），advantage 是多步 TD error 的加权和：

$$
A_t = \delta_t + \gamma\lambda \cdot \delta_{t+1} + (\gamma\lambda)^2 \cdot \delta_{t+2} + \cdots
$$

当 $\gamma = \lambda = 1$（代码默认值）时，展开后 V 项全部抵消：

$$
A_t = \sum_{k=t}^{T-1} r_k - V(s_t)
$$

也就是说，**final reward 通过求和累积直接出现在每个 token 的 advantage 中**：

$$
A_t = \underbrace{\sum_{k=t}^{T-2} (-k\_\text{coef} \cdot \text{KL}_k)}_{\text{中间 token 的 KL 惩罚}} + \underbrace{(-k\_\text{coef} \cdot \text{KL} + \text{reward})}_{\text{最后 token}} - V(s_t)
$$

这样 final reward 一次性传播到所有 token，不需要等 Critic 慢慢学会。

> **注意**：GAE 并不改变 $r_t$ 是什么，它改变的是**怎么从 $r_t$ 计算 advantage**。中间 token 自己的 $r_t$ 始终只是 KL 惩罚，但它的 advantage 包含了从它之后所有 token 的 $r$ 之和。

#### Returns 的含义与 Critic 的自纠正机制

$$
\text{Returns}_t = A_t + V(s_t)
$$

Returns 是 Critic 的**训练目标**。Critic 的 loss 是：

$$
L_{\text{critic}} = \text{MSE}\left(V(s_t), \; \text{Returns}_t\right)
$$

**关键问题**：Critic 一开始对中间 token 的 $V(s_t)$ 预测不准，怎么纠正？

当 $\gamma = \lambda = 1$（代码默认值）时，Returns 展开后 V 项全部抵消：

$$
\text{Returns}_t = A_t + V(s_t) = \sum_{k=t}^{T-1} r_k - V(s_t) + V(s_t) = \sum_{k=t}^{T-1} r_k
$$

也就是说 **Returns 完全不依赖 V**，它就是一个纯蒙特卡洛回报（从位置 t 到结束的所有 reward 之和），其中包含了最后的 response_reward。这意味着即使 Critic 初始预测很差，Returns 仍然是一个准确的训练目标。

整个自纠正闭环：

```
第 1 轮：
  Critic V(s_t) 很差 → A_t 不准 → 但 Returns_t = Σr_k 是准的（不依赖 V）
  → Critic loss = MSE(V, Returns) 驱动 V 修正

第 2 轮：
  Critic V(s_t) 变好一些 → A_t 更准 → policy 更新更好
  → 同时 Returns 继续修正 V

...循环收敛
```

> 当 $\lambda < 1$ 时，Returns 会混合一部分 V 的估计（有偏但方差小），收敛会慢一些但更稳定。这就是 $\lambda$ 控制 bias-variance trade-off 的具体体现。

#### GAE 的代码实现

```python
def vanilla_gae(
    rewards,   # [B, T] 每个 token 的 reward（KL 惩罚 + 最后一个 token 的 response-level reward）
    values,    # [B, T] Critic model 给的 V(s)
    gamma,     # 折扣因子，默认 1.0
    lambd,     # GAE 的 λ，默认 1.0
):
    B, T = rewards.shape
    lastgaelam = torch.zeros(B)  # A_{t+1}，初始化为 0
    adv_rev = []
    
    for t in reversed(range(T)):  # 从后往前推
        next_value = values[:, t + 1] if t < T - 1 else 0.0
        delta = rewards[:, t] + gamma * next_value - values[:, t]  # TD Error
        lastgaelam = delta + gamma * lambd * lastgaelam  # GAE 递推
        adv_rev.append(lastgaelam)
    
    full_advantages = torch.stack(adv_rev[::-1], dim=1)  # 反转：[A_0, A_1, ..., A_{T-1}]
    full_returns = full_advantages + values               # Returns = A + V
    return full_advantages, full_returns
```

#### 整体流程

1. 初始化策略 $\pi$，并与环境交互，得到采样的训练数据
2. 利用这些数据，学习 value function V（Critic）
3. 根据 V，利用 Policy Gradient 来优化策略 $\pi$（Actor）
4. 以此循环

---

### 1.8 GRPO（Group Relative Policy Optimization）

#### 动机：去掉 Critic

PPO 需要一个 Critic 模型来估计 V(s)，这带来两个问题：
1. **显存开销**：需要额外训练一个和 Actor 同等规模的模型
2. **训练困难**：Critic 本身难收敛，两个模型联合训练更难

GRPO 的思路：**不学习全局标准，用组内相对排名替代**。

#### GRPO 的做法

对每个 prompt，生成 N 个 response（一组），然后：

$$
\text{advantage}_i = \frac{\text{reward}_i - \text{group\_mean}}{\text{group\_std}}
$$

- reward 高于组平均 → 正 advantage → 增加概率
- reward 低于组平均 → 负 advantage → 降低概率

**类比**：
- PPO 像"闭卷考"：有个老师（Critic）根据经验给分，学生只要超过老师的预期就算好
- GRPO 像"按名次发奖学金"：不看绝对分，只看在同班同学中的排名

#### GRPO 中 KL 的处理

| | PPO | GRPO |
|--|-----|------|
| KL 位置 | 放在 reward 里（每个 token 减去 KL 惩罚） | 放在总 loss 里（独立的 KL loss 项） |
| 原因 | KL 成为 reward 的一部分，被 Critic 学习 | 如果放在 reward 里会干扰组内归一化 |

#### Advantage → Loss 的完整推导

这是理解 RL 训练的关键环节。

**Step 1：最基本的 Policy Gradient Loss（REINFORCE）**

$$
\text{loss} = -\log \pi(a\mid s) \times \text{advantage}
$$

直觉：
- advantage $> 0$（好动作）→ loss 为负 → 最小化 loss = 增加 $\log \pi$ = 增加概率
- advantage $< 0$（差动作）→ loss 为正 → 最小化 loss = 减小 $\log \pi$ = 降低概率

**Step 2：加入 Importance Sampling（Off-policy）**

$$
\text{loss} = -\text{ratio} \times \text{advantage} = -\frac{\pi_{new}}{\pi_{old}} \times \text{advantage}
$$

当 ratio $= 1$（on-policy）时，退化为 REINFORCE。

**Step 3：加入 PPO Clip**

$$
\text{loss} = \max(-\text{ratio} \times A, \; -\text{clip}(\text{ratio}, 1-\varepsilon, 1+\varepsilon) \times A)
$$

#### On-policy 下 Clip 的作用

如果每批数据只做一次更新（on-policy），那么：
- rollout 时记录 `old_log_prob`
- 训练时计算 `new_log_prob`
- 由于模型参数没变，$\text{ratio} = \exp(\text{new} - \text{old}) \approx 1$
- clip 范围 $[0.8, 1.2]$ 完全不起作用

**结论**：在纯 on-policy（每批数据只更新一次）的设置下，PPO clip 几乎无效，loss 本质上就是 REINFORCE：

$$
\text{loss} \approx -1.0 \times \text{advantage}
$$

Clip 只在**同一批数据做多次更新**时才有意义（第 2、3、... 次更新时 ratio 开始偏离 1）。

#### 与 SFT Loss 的对比

| | SFT | RL (GRPO) |
|--|-----|-----------|
| 目标 | 模仿正确答案 | 强化好的行为，抑制差的行为 |
| Loss | $-\log P(\text{目标token})$ | $-\text{advantage} \times \log P(\text{采样token})$ |
| 信号强度 | 所有目标 token 权重相同 | 按 advantage 大小加权 |
| 数据来源 | 人工标注 | 模型自己生成 + 环境反馈 |

---

### 1.9 RL 与 SFT 的核心区别

在进入 Slime 框架实战之前，有必要深刻理解 RL 和 SFT 在训练范式上的本质区别。这不仅影响你对 loss 曲线的解读，也影响你如何设计 reward function 和调试训练。

#### 学习目标的不同

**SFT 有明确目标**：对于每个输入，都有一个「正确答案」。模型通过最小化交叉熵 loss，直接逼近正确答案的概率分布。SFT 的本质是**模仿**——模型学习的是「在该场景下应该说什么」。

**RL 通过探索优化**：没有唯一正确答案，而是通过不断尝试不同的 response，根据 reward 信号提高高 reward response 的生成概率。RL 的本质是**试错 + 强化**——模型学习的是「什么样的行为能获得更高回报」。

#### Loss 的意义完全不同

这是最容易误解的一点：**RL 的 loss 和 SFT 的 loss 在数值意义上完全不同**。

**SFT Loss 直接反映模型对正确答案的生成概率**：

$$
\text{loss}_{\text{SFT}} = -\log P(\text{正确token})
$$

loss 越小，说明模型生成正确答案的概率越高，模型越好。SFT loss 有明确的绝对意义——它就是模型对正确答案的负对数似然。

**RL Loss 是相对优势转化的中间产物，没有具体的数值意义**：

$$
\text{loss}_{\text{RL}} = -\text{advantage} \times \log P(\text{采样token})
$$

- advantage 是**相对值**（比组内平均好多少），不是绝对值
- loss 为负不代表模型差，loss 为正也不代表模型好——**loss 的大小和训练效果没有直接对应关系**
- 同一个 batch 的 loss 可能因为 advantage 的分布不同而剧烈波动，但这不代表训练在变差

**为什么 RL 的公式总是先推梯度，再反推 loss？** 因为 RL 优化的真正目标是期望 reward $J(\theta) = \mathbb{E}[R]$，我们关心的是梯度的方向（让模型朝高 reward 方向更新），而 loss 只是为了利用深度学习框架的自动求导机制来计算这个梯度的一个**数学等价的替代品**。RL loss 的大小本身不重要，重要的是它产生的梯度方向是否正确。

#### 数据来源的不同

| | SFT | RL |
|--|-----|-----|
| 数据来源 | 人工标注的「正确答案」 | 模型自己生成的 response + reward 信号 |
| 数据质量 | 静态、确定 | 动态、随机（取决于采样） |
| 数据量 | 固定（数据集大小） | 可变（rollout 生成） |
| 数据与模型的关系 | 无关（固定数据集） | 强相关（当前模型生成，用于更新当前模型） |

#### 优化轨迹的不同

**SFT**：loss 曲线平稳下降，因为目标固定，模型在逐步逼近一个确定的目标。训练后期 loss 趋于收敛，模型性能也趋于稳定。

**RL**：loss 曲线波动大，没有明显的下降趋势。因为：
1. 每轮 rollout 的数据分布不同（模型在变化）
2. advantage 是相对的，组内 reward 分布影响 loss 数值
3. 模型变强后，采样的 response 整体变好，advantage 的分布也会变化

> **实践建议**：在 RL 训练中，不要用 loss 曲线来判断训练效果。应该关注 **reward 曲线**（如 mean reward、pass rate）和 **KL 曲线**（当前模型与参考模型的偏离程度）。如果 reward 在上升、KL 在可控范围内，即使 loss 在波动甚至上升，训练也是在正确进行的。

---

## 第二部分：Slime 框架实战

### 2.1 快速上手

> 本节帮你在 5 分钟内理清：**跑 Slime 需要准备什么、关键参数怎么配**。后续 2.2-2.6 会深入每个模块的细节。

#### 准备材料

| 材料 | 说明 | 示例 |
|------|------|------|
| 基座模型 | HuggingFace 格式的模型（用于 tokenizer 和初始化） | `/data/models/Qwen3-8B` |
| Ref 模型 | Megatron 分布式格式的参考模型（用于 KL 约束） | `/data/models/Qwen3-8B_torch_dist/` |
| 训练数据 | JSONL 格式，必须包含 prompt 和 label 字段 | 见下方格式示例 |
| 评估数据 | 可选，JSONL 格式 | `/data/datasets/aime-2024.jsonl` |

**数据集格式示例**（JSONL，每行一条）：

```jsonl
{"prompt": "Solve: What is the value of $x$ if $2x + 3 = 11$?", "label": "4"}
{"prompt": "Find the derivative of $f(x) = x^2 + 3x - 1$.", "label": "2x + 3"}
```

- `prompt` 字段：输入给模型的提示（由 `--input-key` 指定字段名）
- `label` 字段：用于 reward 计算的标签（由 `--label-key` 指定字段名）
- 开启 `--apply-chat-template` 后，框架会自动用模型的 chat template 包装 prompt

#### 三个关键 Batch Size 参数

这是最容易混淆的部分，直接决定了训练是 on-policy 还是 off-policy：

```
rollout_batch_size (bt_size)       = 256    # 每轮取多少个 prompt
n_samples_per_prompt               = 8      # 每个 prompt 生成多少个 response
global_batch_size                  = bt_size × n_samples_per_prompt = 2048
                                              # 一次参数更新用多少样本
```

**核心关系**：
- 每轮 rollout 产生 `bt_size × n_samples_per_prompt` 个 (prompt, response) 对
- 如果 `global_batch_size = rollout总量` → 所有数据用一次 → **on-policy**（默认推荐）
- 如果 `global_batch_size < rollout总量` → 数据分多次更新 → **off-policy**（数据利用率高，但有偏差）

#### GRPO vs PPO 参数速查

| 配置项 | GRPO（推荐入门） | PPO |
|-------|-----------------|-----|
| `--advantage-estimator` | `grpo` | `ppo` |
| 是否需要 Critic 模型 | 不需要 | 需要（额外显存 + 训练） |
| `--use-kl-loss` | **必须开启** | 可选（KL 已在 reward 中） |
| `--kl-loss-coef` | 0.01（可调） | 0（KL 通过 `--kl-coef` 放在 reward 里） |
| `--kl-coef` | 0.0（不放 reward） | 0.01~0.1（放 reward） |
| `--entropy-coef` | 0.0 | 0.0 |
| KL 处理方式 | 作为独立 loss 项 | 作为 reward 的一部分，被 Critic 学习 |
| Advantage 计算 | 组内归一化 `(r - mean) / std` | GAE（需要 Critic 的 V(s)） |
| 显存开销 | 低（无 Critic） | 高（Critic ≈ Actor 大小） |

#### 最小可运行配置（4 卡 GRPO）

```bash
ray start --head --node-ip-address 127.0.0.1 --num-gpus 4 --num-cpus 32 --disable-usage-stats

ray job submit --address="http://127.0.0.1:8265" \
   -- python3 train.py \
   --actor-num-nodes 1 --actor-num-gpus-per-node 4 \
   --colocate \
   --hf-checkpoint /data/models/Qwen3-8B \
   --ref-load /data/models/Qwen3-8B_torch_dist/ \
   --prompt-data /data/datasets/train.jsonl \
   --input-key prompt --label-key label \
   --apply-chat-template \
   --rm-type math \
   --advantage-estimator grpo \
   --rollout-batch-size 256 \
   --n-samples-per-prompt 8 \
   --global-batch-size 2048 \
   --rollout-max-response-len 3000 \
   --use-kl-loss --kl-loss-coef 0.01 --kl-loss-type low_var_kl \
   --use-dynamic-batch-size --max-tokens-per-gpu 9216 \
   --eps-clip 0.2 --eps-clip-high 0.28 \
   --lr 1e-6 --rollout-temperature 1 \
   --num-rollout 2000
```

> 完整脚本和参数说明见[附录 A](#a-完整运行脚本示例)。

---

### 2.2 整体架构概览

Slime 是一个基于 Ray + Megatron-LM + SGLang 的 LLM 强化学习训练框架。

#### 训练循环总览

```
┌─────────────────────────────────────────────────────────────────────┐
│               一轮 Rollout → 参数更新 循环                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ╔═══════════════════════════════════════════════════════════════╗   │
│  ║  Ray 侧（调度 + 推理）                                        ║   │
│  ║                                                               ║   │
│  ║  1. 取 Prompt (data_source.py)                                ║   │
│  ║       │  · 优先从 buffer 取 partial rollout                    ║   │
│  ║       │  · 不足则从数据集顺序读取                                 ║   │
│  ║       │  · 每个 prompt 复制 n_samples_per_prompt 份             ║   │
│  ║       │    [--prompt-data, --input-key, --label-key]            ║   │
│  ║       ▼                                                       ║   │
│  ║  2. Rollout 生成 Response (sglang_rollout.py)                  ║   │
│  ║       │  · SGLang 推理引擎异步生成                               ║   │
│  ║       │  · 记录 log_probs, tokens, response_lengths            ║   │
│  ║       │  · 动态过滤（可选）                                      ║   │
│  ║       │    [--rollout-batch-size, --n-samples-per-prompt,      ║   │
│  ║       │     --rollout-max-response-len, --rollout-temperature] ║   │
│  ║       ▼                                                       ║   │
│  ║  3. 计算 Reward (rm_hub/__init__.py)                           ║   │
│  ║       │  · math/自定义 reward function                          ║   │
│  ║       │    [--rm-type 或 --custom-rm-path]                     ║   │
│  ║       ▼                                                       ║   │
│  ║  4. Reward 后处理                                               ║   │
│  ║       │  · GRPO: 组内归一化 (reward - mean) / std               ║   │
│  ║       │  · 结果写入 sample.train_metadata                       ║   │
│  ║       ▼                                                       ║   │
│  ║  5. 按 DP 切分数据 (_split_train_data_by_dp)                   ║   │
│  ║       │  · 负载均衡切分到各 DP rank                              ║   │
│  ║       │  · 组内归一化已完成，无需保持组完整性                    ║   │
│  ║       ▼                                                       ║   │
│  ║  6. 构建 rollout_data (ray/rollout.py)                         ║   │
│  ║       │  · 将 sample 字段转为 tensor (tokens, log_probs...)    ║   │
│  ║       │  · 传递到 Megatron Worker                               ║   │
│  ║                                                               ║   │
│  ╚═══════════════════════════════╤═══════════════════════════════╝   │
│                                  │ 数据跨进程传递                      │
│  ╔═══════════════════════════════╧═══════════════════════════════╗   │
│  ║  Megatron 侧（训练）                                          ║   │
│  ║                                                               ║   │
│  ║  7. Ref Model Forward (actor.py)                               ║   │
│  ║       │  · 用 ref model 计算每个 token 的 ref_log_probs         ║   │
│  ║       │  · 用于后续 KL 约束                                     ║   │
│  ║       │    [--ref-load 指定 ref 模型路径]                       ║   │
│  ║       ▼                                                       ║   │
│  ║  8. Actor Forward (actor.py)                                   ║   │
│  ║       │  · 用 training backend (Megatron) 重新计算 log_probs    ║   │
│  ║       │  · 消除训推不一致 (SGLang vs Megatron)                  ║   │
│  ║       ▼                                                       ║   │
│  ║  9. 计算 Advantage (loss.py)                                    ║   │
│  ║       │  · GRPO: 所有 token 共享归一化后的 reward                ║   │
│  ║       │  · PPO: GAE 计算 per-token advantage                   ║   │
│  ║       │    [--advantage-estimator grpo|ppo]                    ║   │
│  ║       ▼                                                       ║   │
│  ║  10. 训练 (model.py::train → train_one_step)                   ║   │
│  ║       │  · 切分 micro-batch (data.py::get_data_iterator)       ║   │
│  ║       │  · 对每个 micro-batch:                                  ║   │
│  ║       │     a. forward_step → policy_loss_function             ║   │
│  ║       │        · compute_policy_loss (pg_loss)                 ║   │
│  ║       │        · KL loss + entropy loss                        ║   │
│  ║       │     b. backward + gradient accumulation                ║   │
│  ║       │  · 梯度裁剪 + optimizer.step()                         ║   │
│  ║       │    [--global-batch-size, --use-dynamic-batch-size,    ║   │
│  ║       │     --max-tokens-per-gpu, --use-kl-loss, --kl-loss-coef║   │
│  ║       │     --eps-clip, --lr]                                   ║   │
│  ║       ▼                                                       ║   │
│  ║  11. 同步权重到 Rollout Engine                                  ║   │
│  ║       │  · Megatron → SGLang 权重同步                          ║   │
│  ║                                                               ║   │
│  ╚═══════════════════════════════════════════════════════════════╝   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### 数据生命周期

```
Prompt ──→ Rollout ──→ Sample ──→ rollout_data ──→ DataIterator ──→ batch ──→ Loss
            │            │           │                  │              │          │
         SGLang       reward     tensor 化        micro-batch     get_batch   forward
         生成         计算       + metadata         切片           切片        计算

关键字段流转:
  tokens:           Rollout → rollout_data → DataIterator → batch → forward_step
  log_probs:        Rollout → rollout_data → DataIterator → batch → policy_loss (作为 old_log_probs)
  ref_log_probs:    Ref Forward 写入 → rollout_data → batch → KL loss
  advantages:       compute_advantages_and_returns 写入 → rollout_data → batch → policy_loss
  loss_masks:       Rollout → batch → loss 归一化
```

#### 核心组件

| 组件 | 框架 | 作用 |
|------|------|------|
| Rollout Engine | SGLang | 高效推理，生成 response |
| Actor (Policy) | Megatron-LM | 训练策略模型 |
| Ref Model | Megatron-LM | 提供 KL 约束的参考分布 |
| 调度 | Ray | 分布式任务调度和数据传输 |

#### 训推一体化（Colocate 模式）

默认情况下，训练和推理部署在同一组 GPU 上（`--colocate`）。流程是：
1. Megatron 模型 offload 到 CPU → SGLang 加载模型到 GPU → 推理
2. 推理完成 → SGLang 释放显存 → Megatron 模型 reload 到 GPU → 训练

---

### 2.3 Rollout 阶段

#### 2.3.1 总体流程：`generate` 函数

**核心函数**：`slime/ray/rollout.py::RolloutWorker.generate`

一轮 Rollout 的完整流程由 `generate` 方法调度：

```python
def generate(self, rollout_id):
    start_time = time.time()
    self.rollout_id = rollout_id
    self.health_monitoring_resume()
    if self.args.ci_test and self.args.use_fault_tolerance and rollout_id >= 2:
        self._try_ci_fault_injection()

    # ── 第一步：取数据 + 生成 + 计算 Reward ──
    data, metrics = self._get_rollout_data(rollout_id=rollout_id)

    # ── 日志 & 调试 ──
    self._save_debug_rollout_data(data, rollout_id=rollout_id, evaluation=False)
    _log_rollout_data(rollout_id, self.args, data, metrics, time.time() - start_time)
    if self.args.debug_rollout_only:
        return  # debug 模式：只跑 rollout，不训练

    # ── 第二步：Reward 后处理 + 样本转训练数据 ──
    data = self._convert_samples_to_train_data(data)

    # ── 第三步：按 DP 切分数据 ──
    return self._split_train_data_by_dp(data)
```

三步对应的关系：

| 步骤 | 函数 | 做什么 | 对应训练循环图中的步骤 |
|------|------|--------|---------------------|
| 1 | `_get_rollout_data` | 取 Prompt → 生成 Response → 计算 Reward | Step 1-3 |
| 2 | `_convert_samples_to_train_data` | Reward 后处理（组内归一化等）+ 将 Sample 转为 rollout_data tensor | Step 4-6 |
| 3 | `_split_train_data_by_dp` | 按 DP rank 负载均衡切分 | Step 5 |

> **关键**：Reward 后处理不是在计算 reward 之后立即做的，而是在 `_convert_samples_to_train_data` 中完成。这样设计是因为后处理（如 GRPO 的组内归一化）需要拿到**同一组所有 response 的 reward**，而 rollout 生成是异步的，只有所有 response 都收集齐后才能做归一化。

下面分别展开每一步的细节。

---

#### 2.3.2 第一步：`_get_rollout_data` — 取数据 + 生成 + 计算 Reward

这个函数内部依次调用：数据准备 → 生成 → Reward 计算。

##### 数据准备

**数据源类**：`slime/rollout/data_source.py`

```python
class RolloutDataSourceWithBuffer(RolloutDataSource):
    """
    优先从 Buffer 中取数据，Buffer 不足时再从原始数据集读取新 Prompt。
    Buffer 中存放的是被中断的 partial rollout 数据。
    """
```

数据获取流程：
1. 优先从 buffer 取（存放上一轮被中断的 partial rollout）
2. buffer 不够则从数据集顺序读取
3. 数据集读完一遍后 shuffle 重新开始（epoch += 1）
4. 每个 prompt 复制 `n_samples_per_prompt` 份，准备生成多个 response

> **Partial Rollout 的 On-policy 处理**：当 buffer 中的 partial rollout 数据被当前轮次使用时，这些数据确实是由**上一轮模型**（已更新过参数）生成的——从状态分布的角度看是 off-policy 的。Slime 通过 `--mask-offpolicy-in-partial-rollout` 来处理这个问题：对于 buffer 数据，把旧模型生成的 token 部分的 loss_mask 置为 0，只保留当前模型新生成的 token 参与 loss 计算。这样**动作采样（action）层面保持了 on-policy**——只对当前模型实际生成的 token 计算梯度。但**状态分布层面仍然是 off-policy 的**——prompt 后面跟的是旧模型的 response 前缀，当前模型的生成是在旧前缀的条件下进行的。这在工程上是可接受的权衡：加速了训练，同时避免了最严重的 off-policy 风险（对从未采样的动作计算梯度）。

##### 生成过程

**核心函数**：`slime/rollout/sglang_rollout.py::generate_rollout_async`

生成是一个**边提交、边生成、边处理**的异步流程：

```
while 有效数据 < 需求量:
    if 正在生成的 + 已完成的 < 需求量:
        取一批 prompt → 提交生成任务（异步）
    
    等待任意一个任务完成（asyncio.wait FIRST_COMPLETED）
    
    对完成的 group:
        应用动态过滤器（可选）
        如果通过 → 加入有效数据
        
收集齐后 → abort 剩余任务 → 收集 partial rollout 到 buffer
```

关键设计：
- **异步并行**：不同 prompt 的生成互不等待
- **动态过滤**：可以自定义过滤规则（如过滤太短的回复）
- **Abort 机制**：需求满足后终止剩余任务，节省计算

> **⚠️ 截断样本默认参与训练**：当模型的 response 达到 `max_new_tokens` 限制时，会被标记为 `TRUNCATED` 状态，但**默认仍然会进入训练数据流**，正常计算 loss 和梯度。截断样本的 `loss_mask` 默认全 1，advantage 正常计算。如果需要过滤截断样本，必须自行实现过滤函数并通过 `--dynamic-sampling-filter-path` 或 `--rollout-sample-filter-path` 指定。截断比例可通过日志中的 `truncated_ratio` 监控。

##### Reward 计算

**入口**：`slime/rollout/rm_hub/__init__.py`

通过 `--rm-type` 参数选择 reward function：

```python
if rm_type == "math":
    return 1 if grade_answer_verl(response, label) else 0
# ... 其他类型
```

**自定义 Reward**：
- 实现一个函数，返回 reward 值（float 或 dict）
- 通过 `--rm-type` 或 `--custom-rm-path` 指定

---

#### 2.3.3 第二步：`_convert_samples_to_train_data` — Reward 后处理 + 数据转换

这个函数做两件事：

**1. Reward 后处理**

调用 `_post_process_rewards` 对 reward 做后处理。对于 GRPO 类算法（需要组内归一化），这一步执行：

```python
# 将展平的数据恢复成组（同一个 prompt 的 n_samples_per_prompt 个 response 为一组）
# 组内 reward 归一化：(reward - mean) / std
# 返回 raw_rewards 和 normalized rewards
```

> **为什么归一化放在这里而不是 Reward 计算之后？** GRPO 的组内归一化需要同一组所有 response 的 reward 都算完才能做。而 rollout 是异步的，不同 group 的 reward 计算完成时间不同。`_convert_samples_to_train_data` 是在所有 rollout 数据收集完毕后才调用的，此时所有 reward 已就绪，可以安全地做组内归一化。此外，如果需要自定义 reward 后处理（如 DCPO 的分别归一化），也在这里通过 `--custom-reward-post-process-path` 注入。

归一化后的 reward 就是每个 response 的 advantage（GRPO 中所有 token 共享同一个 advantage）。

**2. 样本 → 训练数据转换**

将 `Sample` 对象列表转为 `rollout_data`（dict of tensors），供后续 Megatron 训练使用：

```
Sample (list)                    rollout_data (dict[str, list])
├── sample.tokens          →      rollout_data["tokens"]
├── sample.log_probs       →      rollout_data["log_probs"]
├── sample.reward          →      rollout_data["rewards"]       ← 归一化后的 reward
├── sample.raw_reward      →      rollout_data["raw_reward"]   ← 原始 reward
├── sample.loss_mask       →      rollout_data["loss_masks"]
├── sample.response_length →      rollout_data["response_lengths"]
└── sample.train_metadata  →      rollout_data["metadata"]     ← 包含归一化 advantage 等
```

---

### 2.4 数据分发

#### 2.4.1 按 DP 切分数据

**函数**：`slime/ray/rollout.py::_split_train_data_by_dp`

```python
# 按长度做负载均衡切分（如果 --balance-data）
partitions = get_seqlen_balanced_partitions(total_lengths, dp_size)

# 每个 DP 组拿到自己的数据子集
for i in range(dp_size):
    rollout_data[key] = [data[key][j] for j in partitions[i]]
```

注意：同一个 prompt 的多个 response 不需要分到同一个 DP 组，因为组内归一化已经在前面完成了。

#### 2.4.2 切分成 Micro-batch

**函数**：`slime/backends/megatron_utils/data.py::get_data_iterator`

这个函数决定的是"数据在当前 DP shard 上以什么 micro-batch 顺序喂给 pipeline"，而不是"数据放到哪个 GPU"。

关键计算：
```python
num_local_samples = len(rollout_data["total_lengths"])  # 当前 DP 组的样本数
num_local_gbs = global_batch_size // dp_size            # 一次更新需要的样本数
num_steps_per_rollout = num_local_samples // num_local_gbs  # 更新步数（通常 = 1）
```

**动态 Batch Size**（推荐开启 `--use-dynamic-batch-size`）：

处理流程：
1. 计算当前 DP shard 拿到的样本数
2. 计算当前 DP shard 更新所需要的样本数（global_batch_size // dp_size）
3. 计算更新的步数：通过上面两个相除（一般 step=1，是 on-policy 算法）
4. 计算每一步更新至少需要多少个 micro-batch：`args.max_tokens_per_gpu * cp_size` 是一个 micro-batch 在整个 CP 组内能容纳的最大 token 数。通过first-fit算法(就是一直往大里塞，直到再塞进去就会超过上限，就换到下一个batch开始塞)

5. 不同 DP Group 之间同步 num_microbatches，都取最大的，防止有的 DP Group 算完了然后通信堵塞。这里保证不同的DP Group要处理的microbatches相同，方便并行
6. 每个 step 根据计算好的 micro-batch 数目做实际切分，保证负载均衡

```
假设 DP 组 A 数据短 → 算出需要 2 个 micro-batch
假设 DP 组 B 数据长 → 算出需要 4 个 micro-batch
all_reduce(MAX) → 两组都跑 4 个 micro-batch（A 的 batch 更小）
```

这样保证所有 DP 组同步完成，避免通信等待。

**动态计算的"动态"体现在哪？**
- **数量动态**：如果这批数据整体很长，num_microbatches 会变大（流水线步数增加，每步变细）
- **组合动态**：每一组 micro-batch 里包含哪些样本是不固定的，完全取决于如何组合能达到最优的长度平衡
- **步调动态**：虽然每个 DP 组本地数据不同，但通过全局协商，动态地达成一个全集群统一的最优执行节奏

**返回值**：
- `list[DataIterator]`：每个 VPP stage 一个 iterator（长度等于 VPP_Size）
- `list[int]`：长度等于 num_steps_per_rollout，每个数代表这一个 step 要执行多少个 micro-batch

**涉及参数**：
- `--use-dynamic-batch-size`：开启动态 batch size（推荐）
- `--max-tokens-per-gpu`：每张 GPU 处理的最大 token 数。启用动态批处理后，系统会智能地将长短不一的样本打包，使每个 micro-batch 的总 token 数接近此限制

##### 两阶段分桶：First-Fit + Karmarkar-Karp

实际的 micro-batch 切分分为两步：

**第一步：计算 num_microbatches（First-Fit 算法）**

`get_minimum_num_micro_batch_size` 使用 First-Fit（贪心装箱）计算最少需要多少个 micro-batch：

```
max_tokens = max_tokens_per_gpu * cp_size

对每个样本（按长度降序排列）：
  找到第一个当前总 token 数 + 该样本长度 <= max_tokens 的桶
  如果找到 → 放入该桶
  如果找不到 → 开一个新桶

结果：num_microbatches = 桶的数量
```

First-Fit **保证每个桶不超过 max_tokens**，但分桶结果不一定均衡。

**第二步：用 Karmarkar-Karp 算法重新分桶**

`get_seqlen_balanced_partitions` 使用 KK 算法重新分配样本到 `num_microbatches` 个桶中，目标是最小化桶间 token 总数的差异：

```
输入：样本长度列表 [3, 3, 2, 2, 2]，num_partitions = 2
KK 算法目标：让两个桶的 token 总数尽量接近

结果：桶1 = [3, 2] = 5 tokens，桶2 = [3, 2, 2] = 7 tokens
```

**KK 算法只优化均衡性，不保证每个桶不超过 max_tokens。**

##### get_seqlen_balanced_partitions 可能超限的问题

KK 算法只优化均衡性，**不保证每个桶不超过 max_tokens**。这在实际中会触发：

```
max_tokens = 6
样本长度：[3, 3, 2, 2, 2]

第一步 First-Fit：
  桶1: [3, 3] = 6  ✓
  桶2: [2, 2, 2] = 6  ✓

  num_microbatches = 2，每个桶都 <= 6

第二步 KK 重分桶（num_partitions = 3）
  KK 目标：让 3 个桶的 token 总数尽量均衡

  可能的结果：
  桶1: [3, 3] = 6  ✓
  桶2: [2, 2, 2] = 6  ✓
  （这种情况下恰好没有超限）

但另一组数据：
  样本长度：[3, 3, 2, 2, 2]（同样数据，不同的 KK 分法）

  可能的结果：
  桶1: [2,3,2] = 6  ✓
  桶2: [3, 2] = 4  ✓

KK 重分桶后可能变成 (2,3,2), (3,2)，第一个桶从 6 变成了 7，超过上限！
```

**为什么会超限？**

KK 算法的优化目标是最小化所有桶的最大总和（即 min-max），但它是启发式算法，且**完全不知道 max_tokens 的存在**。它只知道要分几个桶，然后把样本分进去，让桶间尽量均衡。均衡性和"每个桶不超限"是两个不同的约束，KK 只优化前者。

##### 对 DSA 模型的特殊影响

对于 DSA（DeepSeek Attention）等模型，训练时通常将所有样本 padding 到同一个长度（即当前 micro-batch 内最长样本的长度），以避免 TileLang 频繁编译不同长度的 kernel。

```
假设 max_tokens_per_gpu = 9216
一个 micro-batch 包含 2 个样本：长度 [5000, 4500]，总 token = 9500

正常情况（不超限）：padding 到 5000，实际显存 = 5000 × 2 = 10000
超限情况：如果 KK 分桶后某个桶总 token = 9500 > 9216
  → padding 到 9500 → 实际显存 = 9500 × 2 = 19000
  → 几乎翻倍，很容易 OOM
```

更极端的情况：如果一个桶里有多个短样本和一个特别长的样本，padding 后的显存占用可以远超 max_tokens_per_gpu。

##### 当前代码的处理方式

在 `get_data_iterator` 中，如果 KK 分桶后某个桶超过 max_tokens，当前代码会 fallback 到 `_get_capped_partitions`（First-Fit 算法），保证每个桶不超过 max_tokens。

但 `_get_capped_partitions` 本身存在问题：当 `num_partitions > 实际需要的桶数` 时（常见于 `all_reduce MAX` 后某些 DP rank 被分配了多余的桶），会产生**空桶**，导致后续 `torch.cat([])` 报错。这是目前社区的已知问题，官方正在修复中，详见 [GitHub Issue #1838](https://github.com/THUDM/slime/issues/1838)。

#### VPP（Virtual Pipeline Parallelism）

PP 是 pipeline 并行，把模型的不同层分到不同 GPU 上。假如 PP=2，模型有 8 层：
```
GPU0: 前 4 层
GPU1: 后 4 层
```

VPP 是在一张卡上对分到的模型层再做切分。比如 VPP=2：
```
GPU0:
  Stage0: 前 2 层
  Stage1: 2~4 层
GPU1:
  Stage2: 4~6 层
  Stage3: 6~8 层
```

这样让 pipeline 更细粒度，让 forward/backward overlap 更好，让 GPU 更少等待通信。每个 VPP stage 需要一个独立的 data iterator。

#### 从 Micro-batch 切分到 Forward：DataIterator → get_batch → forward_step

micro-batch 切分完成后，数据通过 `DataIterator` 和 `get_batch` 两个层级传递到模型：

```
rollout_data (dict[str, list])
    │  包含: tokens, log_probs, advantages, loss_masks, ...  (整个 DP shard)
    │
    ▼
get_data_iterator() → DataIterator
    │  内部: micro_batch_indices = [[idx1,idx2,...], [idx3,...], ...]
    │  每个 list[int] 是一个 micro-batch 的样本索引
    │
    ▼  Pipeline 引擎每步调用 DataIterator
DataIterator.get_next(keys)
    │  返回: {"tokens": [tensor[idx] for idx in indices[current]],
    │         "log_probs": [tensor[idx] for idx in indices[current]], ...}
    │  即一个 micro-batch 的原始 list-of-tensors
    │
    ▼  forward_step 的第一行调用
get_batch(data_iterator, keys)
    │  1. 调用 data_iterator.get_next(keys) 获取 micro-batch
    │  2. 保存原始 tokens 为 "unconcat_tokens"（用于后续 loss 计算）
    │  3. Context Parallelism 切分 + padding + 构建 PackedSeqParams
    │  返回: {"tokens": [1, T_padded], "unconcat_tokens": list[Tensor],
    │         "packed_seq_params": PackedSeqParams, ...其他 keys 直接透传}
    │
    ▼
forward_step 使用 batch dict
```

**关键理解**：
- `DataIterator` 负责"哪些样本"——按 micro_batch_indices 切片
- `get_batch` 负责"数据格式"——CP 切分、padding、构建 attention 参数
- `get_batch` 的 `keys` 参数决定从迭代器中取哪些字段；缺失的字段返回 `None`，这是添加新字段时框架的容错机制
- 传递到 `forward_step` 的 `batch` 中，tensor 类字段已经是 micro-batch 大小，不再是全量数据

---

### 2.5 Advantage 计算

> **每个 token 的 advantage 还是整个序列共享？** 这取决于算法：
> - **GRPO**：所有 token 共享同一个 outcome-level advantage（组内归一化后的 reward），即同一 response 内 `adv[t] = reward` 对所有 t 成立
> - **PPO**：通过 GAE 计算每个 token 的 advantage，不同 token 有不同的 advantage 值
>
> 无论哪种方式，`compute_advantages_and_returns` 的输出都是**每个 token 一个 advantage 值**的 tensor，只是 GRPO 中这些值相同而已。

**函数**：`slime/backends/megatron_utils/loss.py::compute_advantages_and_returns`

#### GRPO 模式

最简单：所有 token 共享同一个 outcome-level advantage。

```python
# reward 已经在 rollout 阶段做了组内归一化
# 直接把归一化后的 reward 作为每个 token 的 advantage
for i in range(num_samples):
    adv = torch.full((seq_len,), rewards[i])
    advantages.append(adv)
```

GRPO 中 advantage 就是 reward 的组内归一化值，return = advantage（因为没有 Critic，不需要训练 value model）。

#### PPO 模式

需要 Critic 模型 + GAE。PPO 中 KL 是放在 reward 里的：

```python
# 1. 构建 token-level reward
#    - 每个 token: -kl_coef * KL(π_new || π_ref)  （KL 惩罚）
#    - 最后一个 token: 额外加上 response-level reward
rewards[i, t] = -kl_coef * kl[i, t]                    # 每个 token 都惩罚偏离 ref
rewards[i, last_token] += response_level_reward[i]      # 最后一个 token 加上 RM 奖励

# 2. 用 GAE 计算每个 token 的 advantage
advantages, returns = vanilla_gae(rewards, values, gamma=1.0, lambd=1.0)
```

> reward 本身是 sequence-level 的（比如打游戏只有一局结束才给 reward），我们需要对每个 token 估计 advantage（这个 token 对最终 reward 的贡献）。像 GRPO 那样对所有 token 都给一样的 reward 其实是很粗糙的，因为每个 token 对最终 reward 的贡献并不相同。

**PPO 和 GRPO 中 KL 的区别**：
- **PPO**：KL 放在 reward 里，对每个 token 直接减去 KL 惩罚，KL 成了奖励的一部分被 Critic 学习
- **GRPO**：不在 reward 中做 KL，直接把 KL 放到总的 loss function 里。如果放在 reward 里会干扰组间优势的计算

#### KL 散度的三种估计方式

在计算 $\text{KL}(\pi_{new} \| \pi_{ref})$ 时，理论公式无法精确计算，需要用采样估计：

```python
# 方式 1：直接用 log ratio（无偏，但方差大，可能为负）
kl = log_probs - ref_log_probs

# 方式 2：泰勒展开（有偏，但非负）
kl = (log_probs - ref_log_probs) ** 2 / 2.0

# 方式 3：低方差无偏估计（推荐，slime 默认使用 low_var_kl）
log_ratio = ref_log_probs - log_probs
kl = log_ratio.exp() - 1 - log_ratio
# 在 ratio ≈ 1 附近变化平滑，方差小，且始终非负
```

---

### 2.6 Loss 计算与训练

#### 2.6.1 准备训练所需的信息

在进入 loss 计算之前，`slime/backends/megatron_utils/actor.py::train_actor` 会准备以下数据：

1. 对每条 response 计算 **ref model** 对每个 token 的 log_probs，更新到 data 中
2. 也可能计算 **teacher model** 的 log_probs（teacher 需要和 actor model 同样结构）
3. 再跑一遍 **actor**，计算 log_probs。这次是用 training backend（Megatron）进行 forward，之前 rollout 时虽然也有 log_probs，但是用推理 engine（SGLang）跑的，可能导致训推不一致
4. 如果有 Critic（PPO），actor 和 critic 之间交换数据
5. 计算 advantage → `compute_advantages_and_returns`

#### 2.6.2 从 Advantage 到 Loss

> **数据从哪来？** `policy_loss_function` 需要的所有数据通过 `get_batch(data_iterator, keys)` 从 `rollout_data` 中按 micro-batch 切片获取。GRPO 需要的核心字段为：`tokens`、`log_probs`（rollout 时的 log P）、`ref_log_probs`（ref model 的 log P）、`advantages`、`loss_masks`、`response_lengths`。这些字段在 `compute_advantages_and_returns` 及之前的步骤中已被填充。

> **On-policy 下 ratio=1，loss 是否和当前模型无关？** 这是一个常见的困惑点。当 on-policy 第一次 forward 时，$\text{ratio} = \pi_{new} / \pi_{old} \approx 1$，所以 $\text{loss} \approx -\text{advantage}$。但这**并不意味着 loss 和模型参数无关**：虽然 ratio 系数≈1，但 $\text{loss} = -\text{ratio} \times \text{advantage}$ 中的 advantage 是常数（从 rollout 时计算好的），而梯度是通过 $\text{ratio} = \exp(\text{new\_log\_prob} - \text{old\_log\_prob})$ 中的 `new_log_prob` 对模型参数 $\theta$ 求导得到的。即梯度为 $-\text{ratio} \times \nabla_\theta \log \pi(a\mid s) \times \text{advantage}$（其中 $\nabla_\theta$ 表示对 $\theta$ 求梯度）。当 ratio≈1 时，梯度近似为 $-\nabla_\theta \log \pi(a\mid s) \times \text{advantage}$——这正是 REINFORCE 的梯度公式。所以 loss 的**值**看起来和模型无关（≈-advantage），但 loss 的**梯度**完全依赖当前模型的概率分布。或者说：$\text{loss} = -\text{ratio} \times \text{advantage}$ 中的 `ratio` 是一个关于 $\theta$ 的函数，不是常数 1；只是在这一步，ratio 的**取值**碰巧是 1。

**函数**：`slime/backends/megatron_utils/loss.py::policy_loss_function`

完整流程：

```python
# 1. 计算当前策略的 log_probs 和 entropy
log_probs, entropy = get_log_probs_and_entropy(logits, ...)

# 2. 计算 ppo_kl（用于 importance ratio）
#    注意：这里的 old_log_probs 是 rollout 时记录的（用于计算 ratio）
#    和 ref_log_probs（用于 KL loss）是不同的
ppo_kl = old_log_probs - log_probs

# 3. 计算 policy loss（PPO clipped surrogate）
pg_loss, pg_clipfrac = compute_policy_loss(ppo_kl, advantages, eps_clip, eps_clip_high)

# 4. 应用 TIS 校正（如果启用）
# 5. 计算 KL loss（与 ref model）
# 6. 计算 entropy loss
# 7. 汇总
```

**`compute_policy_loss` 详解**（`slime/utils/ppo_utils.py:125-148`）：

```python
def compute_policy_loss(ppo_kl, advantages, eps_clip, eps_clip_high):
    ratio = (-ppo_kl).exp()  # π_new / π_old
    
    # 无 clip 的 loss
    pg_losses1 = -ratio * advantages
    
    # clip 后的 loss
    pg_losses2 = -ratio.clamp(1 - eps_clip, 1 + eps_clip_high) * advantages
    
    # 取较大者（对应原始目标中的取 min）
    pg_loss = torch.maximum(pg_losses1, pg_losses2)
    
    # clip 比例（用于监控）
    clipfrac = torch.gt(pg_losses2, pg_losses1).float()
    
    return pg_loss, clipfrac
```

**TIS（Truncated Importance Sampling）的作用**：

PPO 的公式里面已经有 IS 了，为什么还需要 TIS？
- 目的不同：PPO 的 clip 是限制更新幅度，TIS 是判断"这个数据还能不能用"
- 当 importance_ratio 极大时，说明这个样本产生的梯度已经完全不可信了
- TIS 通过 `tis_func` 把它强行压低或者直接丢弃，保护模型不被无效的 off-policy 数据带偏
- 也就是不适合继续用于训练的数据就不要用了，PPO 里面加了 IS 也没用

#### 2.6.3 总 Loss 的组成

```python
loss = pg_loss                          # 策略损失（核心）
     - entropy_coef * entropy_loss      # 熵正则化（鼓励探索）
     + kl_loss_coef * kl_loss           # KL 约束（与 ref model 的距离）
```

| 组成部分 | 作用 | 典型系数 |
|---------|------|---------|
| pg_loss | 根据 advantage 调整策略 | 1.0 |
| entropy_loss | 防止策略过于确定（鼓励探索） | 0.0（GRPO 通常不用） |
| kl_loss | 防止偏离 ref model 太远 | 0.01（可调） |

#### 2.6.4 训练循环

**函数**：`slime/backends/megatron_utils/model.py::train`

```python
def train(rollout_id, model, optimizer, data_iterator, num_microbatches):
    # num_microbatches是一个list, 它里面元素的个数决定了更新的 step, 
    # 如果是 on-policy 更新，长度就是 1，比如 [38]
    # 即进行一步更新，一步更新里面用了 38 个 micro-batch 的梯度累加
    # 这个step代表用一轮"rollout"出来的数据做多少次参数更新
    for step_id in range(num_steps_per_rollout):  # 通常 = 1（on-policy）
        train_one_step(...)
```

`train_one_step` 执行一个完整的优化步：
1. **梯度清零**
2. **流水线并行 forward + backward**：`forward_backward_func` 内部会循环 N 次（处理 N 个 micro-batch），将这 N 个 micro-batch 的前向传播和反向传播的梯度进行累加（Gradient Accumulation）
3. **梯度准备**：处理 FP16、梯度裁剪等
4. **权重更新**：optimizer.step()（只更新一次）
5. **学习率调整**

关键理解：`num_microbatches = [38]` 意味着一步更新中有 38 个 micro-batch 的梯度累加，但只做一次 optimizer.step()。每执行完一次 `train_one_step` 会记录一个 `train/step`。

> **KL Loss 说明**：对 GRPO 来说 `--use-kl-loss` 必须开启（和 ref model 的 KL 约束），因为 GRPO 不像 PPO 那样在 reward 中已经考虑了 KL。如果 `kl_loss_coef = 0`，则 KL 散度不会被计入 loss，只作为观测指标。
>
> **Entropy Loss 说明**：熵损失用来鼓励策略保持一定的随机性（探索）。通过乘以一个负的 entropy coefficient 来惩罚过于确定的策略。

---

### 2.7 日志与监控

#### 2.7.1 日志系统总览

Slime 的日志系统由三层组成：

```
数据产生层（各模块计算指标）
    │
    ▼
聚合/汇集层（Ray 侧聚合 / Megatron 侧 all-reduce）
    │
    ▼
输出层（logging_utils.log → WandB / TensorBoard）
```

| 层级 | 入口函数 | 运行位置 | 作用 |
|------|---------|---------|------|
| Rollout 日志 | `_log_rollout_data` (ray/rollout.py) | Ray Actor | 聚合所有 response 级指标 |
| Eval 日志 | `_log_eval_rollout_data` (ray/rollout.py) | Ray Actor | 聚合评估指标 |
| 训练日志 | `train_one_step` 末尾 (megatron_utils/model.py) | Megatron Worker | 训练 loss/梯度等指标 |
| Rollout 数据日志 | `log_rollout_data` (megatron_utils/data.py) | Megatron Worker | 训练前在 Megatron 侧记录的数据级指标 |

#### 2.7.2 四类日志的详细说明

##### 类型 1：Rollout 日志（Ray 侧，`rollout/` 前缀）

**时机**：每轮 rollout 完成后，在 Ray Actor 上执行。

**调用链**：
```
rollout_one_batch()
  → _log_rollout_data(rollout_id, args, samples, ...)
    → compute_metrics_from_samples(args, samples)  # 计算 response 级指标
    → compute_perf_metrics_from_samples(args, samples, rollout_time)  # 计算性能指标
    → logging_utils.log(args, log_dict, step_key="rollout/step")  # 写入 WandB/TensorBoard
```

**核心函数**：`slime/ray/rollout.py::compute_metrics_from_samples`

**记录的指标**：

| 指标 | 含义 | 来源 |
|------|------|------|
| `rollout/response_len/mean` | Response 长度均值 | `compute_statistics` |
| `rollout/response_len/min` | Response 长度最小值 | `compute_statistics` |
| `rollout/response_len/max` | Response 长度最大值 | `compute_statistics` |
| `rollout/repetition_frac` | 重复样本比例 | `has_repetition` |
| `rollout/truncated_ratio` | 被截断的样本比例 | `sample.status` |
| `perf/rollout_time` | Rollout 耗时 | `rollout_time` |
| `perf/tokens_per_gpu_per_sec` | 推理吞吐 | 计算 |



##### 类型 2：Eval 日志（Ray 侧，`eval/` 前缀）

**时机**：每轮 eval 完成后执行。

**调用链**：
```
evaluate()
  → _log_eval_rollout_data(rollout_id, args, data, ...)
    → compute_metrics_from_samples(args, samples)  # 复用同样的计算函数
    → logging_utils.log(args, log_dict, step_key="eval/step")
```

**核心函数**：同样使用 `compute_metrics_from_samples`（和训练 rollout 共用），但前缀变成 `eval/`。

**记录的指标**：与 Rollout 日志相同，加上：
| 指标 | 含义 |
|------|------|
| `eval/{dataset_name}` | eval 数据集上的平均 reward |
| `eval/{dataset_name}-truncated_ratio` | eval 截断比例 |

> **关键**：Eval 也走 `compute_metrics_from_samples`，所以 `sample.metadata` 中的自定义指标在 eval 时也会自动记录。

##### 类型 3：训练日志（Megatron 侧，`train/` 前缀）

**时机**：每个训练 step 完成后执行。

**调用链**：
```
train_one_step()
  → loss_function()  # 返回 loss_dict
  → 在 model.py:643 处构造 log_dict
  → logging_utils.log(args, log_dict, step_key="train/step")
```

**核心位置**：`slime/backends/megatron_utils/model.py:643-655`

**记录的指标**（来自 `loss_function` 的返回值 `loss_dict`）：

| 指标 | 含义 | 正常范围 |
|------|------|---------|
| `train/pg_loss` | 策略损失 | 接近 0（GRPO 正负抵消） |
| `train/pg_clipfrac` | 被 clip 的比例 | on-policy 时 ≈ 0 |
| `train/ppo_kl` | 新旧策略的 KL | on-policy 时 ≈ 0 |
| `train/kl_loss` | 与 ref model 的 KL | 随训练缓慢增大 |
| `train/entropy_loss` | 策略的熵 | 不应快速下降 |
| `train/grad_norm` | 梯度范数 | 不应突然变大 |
| `train/lr-pg_0` | 学习率 | 由 scheduler 决定 |

##### 类型 4：Rollout 数据日志（Megatron 侧，`rollout/` 前缀）

**时机**：训练前，在 Megatron Worker 上执行（data.py 中的 `log_rollout_data`）。

**调用链**：
```
log_rollout_data(rollout_id, args, rollout_data)
  → 遍历 rollout_data 的各个字段，计算 mean
  → gather_log_data("rollout", args, rollout_id, log_dict)  # 跨 DP rank 聚合
    → dist.gather_object()  # all-reduce across DP ranks
    → logging_utils.log(args, reduced_log_dict, step_key="rollout/step")
```

**核心位置**：`slime/backends/megatron_utils/data.py:430-501`

**与类型 1 的区别**：类型 1 记录的是 **response 级**统计（长度分布、reward 统计等），类型 4 记录的是 **tensor 级**统计（log_probs、advantages、rewards 等张量的均值）。

**记录的指标**：

| 指标 | 含义 |
|------|------|
| `rollout/rewards` | 归一化后的 reward 均值（接近 0） |
| `rollout/raw_reward` | 原始 reward 均值 |
| `rollout/advantages` | advantage 均值（GRPO 中 ≈ reward） |
| `rollout/log_probs` | 旧策略 log_prob 均值 |
| `rollout/ref_log_probs` | ref 模型 log_prob 均值 |
| `rollout/entropy` | 策略熵均值 |

#### 2.7.3 日志写入后端（WandB / TensorBoard）

所有日志最终通过 `slime/utils/logging_utils.py::log()` 写入后端：

```python
def log(args, metrics, step_key: str):
    if args.use_wandb:
        wandb.log(metrics)           # 写入 WandB
    if args.use_tensorboard:
        # 过滤掉 step_key 本身，写入 TensorBoard
        metrics_except_step = {k: v for k, v in metrics.items() if k != step_key}
        _TensorboardAdapter(args).log(data=metrics_except_step, step=metrics[step_key])
```

**X 轴（step）的对应关系**：

| 前缀 | X 轴 key | 递增方式 |
|------|---------|---------|
| `rollout/` | `rollout/step` | 每轮 rollout +1 |
| `eval/` | `eval/step` | 每轮 eval +1 |
| `train/` | `train/step` | 每个训练 step +1 |

**注意**：`rollout/step` 出现两次（类型 1 和类型 4 共用同一个 step），但因为类型 1 和类型 4 的指标名不完全重叠，所以不会冲突。类型 1 的指标前缀为 `rollout/`（但 TensorBoard 中会带 `perf/` 等），类型 4 的所有指标也以 `rollout/` 开头。

**启用方式**：

```bash
# TensorBoard
--use-tensorboard --tb-project-name <项目名> --tb-experiment-name <实验名>
# 或设置环境变量 TENSORBOARD_DIR

# WandB
--use-wandb
```

#### 2.7.4 关键指标解读

| 指标 | 含义 | 正常范围 |
|------|------|---------|
| `train/pg_loss` | 策略损失 | 接近 0（GRPO 正负抵消） |
| `train/pg_clipfrac` | 被 clip 的比例 | on-policy 时 ≈ 0 |
| `train/ppo_kl` | 新旧策略的 KL | on-policy 时 ≈ 0 |
| `train/kl_loss` | 与 ref model 的 KL | 随训练缓慢增大 |
| `train/entropy_loss` | 策略的熵 | 不应快速下降 |
| `train/grad_norm` | 梯度范数 | 不应突然变大 |
| `rollout/rewards` | 归一化后的 reward | 接近 0（组内归一化） |
| `rollout/raw_reward` | 原始 reward | 应随训练提升 |

#### 2.7.5 如何添加自定义日志

根据需要添加的指标类型，在不同位置修改：

##### 在 Ray 侧添加 response 级指标（训练 + eval 都能看到）

修改 `slime/ray/rollout.py::compute_metrics_from_samples`：

```python
def compute_metrics_from_samples(args, samples):
    log_dict = {}
    log_dict |= dict_add_prefix(compute_statistics(response_lengths), "response_len/")
    # ... 现有指标 ...

    # 添加自定义指标
    # 1. 从 sample.metadata 读取（rollout 时写入的）
    if samples and isinstance(samples[0].metadata, dict) and "my_metric" in samples[0].metadata:
        values = [s.metadata.get("my_metric", 0.0) for s in samples if isinstance(s.metadata, dict)]
        log_dict["my_metric"] = sum(values) / len(values)

    # 2. 从 sample 的属性直接计算
    log_dict["my_custom_metric"] = np.mean([...]).item()

    return log_dict
```

**关键点**：
- `compute_metrics_from_samples` 同时被 `_log_rollout_data` 和 `_log_eval_rollout_data` 调用
- 在 `_log_rollout_data` 中指标会被加上 `rollout/` 前缀
- 在 `_log_eval_rollout_data` 中指标会被加上 `eval/{dataset_name}/` 前缀
- 所以只需在一处添加，训练和 eval 都能自动记录

##### 在 Megatron 侧添加 tensor 级指标

修改 `slime/backends/megatron_utils/data.py::log_rollout_data`：

```python
# 方式 1：从 rollout_data 的 tensor 字段读取
# rollout_data 中已有的字段：tokens, log_probs, ref_log_probs, rewards,
#   advantages, loss_masks, response_lengths, raw_reward, metadata 等
# 对于 tensor 类型，会自动做 mean 聚合：
log_dict["my_tensor_metric"] = rollout_data["my_tensor_field"]  # 自动 mean

# 方式 2：从 metadata 读取标量
metadata_list = rollout_data.get("metadata", [])
if metadata_list and "my_metadata_key" in metadata_list[0]:
    values = [m.get("my_metadata_key", 0.0) for m in metadata_list]
    log_dict["my_metadata_key"] = sum(values) / len(values)
```

**跨 DP rank 聚合**：`log_rollout_data` 末尾调用 `gather_log_data`，会通过 `dist.gather_object` 在 DP rank 间做 all-reduce mean，最终只有 DP source rank 输出日志。

##### 在训练阶段添加 loss 级指标

修改 `slime/backends/megatron_utils/loss.py::loss_function`，在返回的 `loss_dict` 中添加：

```python
loss_dict = {
    "pg_loss": pg_loss,
    "pg_clipfrac": pg_clipfrac,
    # ... 现有指标 ...
    "my_loss_metric": my_value,  # 添加自定义指标
}
```

`loss_dict` 中的值会自动在 `model.py:643` 被加上 `train/` 前缀并写入后端。

##### 在 rollout 阶段写入 metadata（供后续 log 读取）

在 `slime/rollout/rm_hub/` 的 reward 函数中写入 `sample.metadata`：

```python
# 在 async_rm 或 post_process 中
sample.metadata["my_metric"] = computed_value
```

然后在 `compute_metrics_from_samples` 或 `log_rollout_data` 中读取即可。

#### 2.7.6 日志数据流图

```
                                ┌─────────────────────────────────────────┐
                                │           Rollout 阶段 (Ray)             │
                                │                                         │
                                │  sglang_rollout.py                      │
                                │    ├── generate_rollout_async()         │
                                │    │     生成 response，记录 metadata    │
                                │    ├── async_rm()                       │
                                │    │     计算 reward，写入 sample.reward  │
                                │    └── reward 后处理（可选）              │
                                │          写入 sample.train_metadata     │
                                │                                         │
                                └─────────────┬───────────────────────────┘
                                              │
                              ┌───────────────┴───────────────┐
                              │                               │
                              ▼                               ▼
               ┌──────────────────────────┐   ┌──────────────────────────┐
               │  _log_rollout_data()     │   │  _log_eval_rollout_data()│
               │  (Ray 侧，训练时)         │   │  (Ray 侧，eval 时)       │
               │                          │   │                          │
               │  compute_metrics_from_   │   │  compute_metrics_from_   │
               │    samples()             │   │    samples()             │
               │  compute_perf_metrics_   │   │  + eval reward 统计      │
               │    from_samples()        │   │                          │
               │                          │   │                          │
               │  前缀: rollout/          │   │  前缀: eval/             │
               │  step_key: rollout/step  │   │  step_key: eval/step     │
               └───────────┬──────────────┘   └───────────┬──────────────┘
                           │                              │
                           └──────────┬───────────────────┘
                                      │
                                      ▼
                          ┌──────────────────────────┐
                          │  logging_utils.log()     │
                          │  → wandb.log()           │
                          │  → TensorboardAdapter    │
                          └──────────────────────────┘

                                ┌─────────────────────────────────────────┐
                                │          训练阶段 (Megatron)              │
                                │                                         │
                                │  data.py::log_rollout_data()            │
                                │    ├── 遍历 rollout_data 的 tensor 字段  │
                                │    ├── gather_log_data() 跨 DP 聚合     │
                                │    │     前缀: rollout/                 │
                                │    │     step_key: rollout/step          │
                                │    └── logging_utils.log()              │
                                │                                         │
                                │  model.py::train_one_step() 末尾        │
                                │    ├── 从 loss_dict 构造 log_dict       │
                                │    │     前缀: train/                   │
                                │    │     step_key: train/step            │
                                │    └── logging_utils.log()              │
                                │                                         │
                                └─────────────────────────────────────────┘
```

---

## 第三部分：自定义修改案例 — 以 DCPO 为例

> 前面介绍了 Slime 框架的标准使用方式（GRPO/PPO）。在实际研究中，我们经常需要对框架进行自定义修改——比如添加新的 reward 类型、修改 advantage 计算方式、或在 loss 中引入额外约束。本部分以 DCPO（Decoupled Calibration Policy Optimization）为例，完整展示如何在 Slime 框架上进行扩展，涵盖从 reward 计算、advantage 构建、loss 修改到日志记录的全流程。
>
> DCPO原文: https://arxiv.org/abs/2603.09117。原文是用 verl 实现的，现在我们尝试用 slime 来实现。

### 3.1 DCPO 原理

DCPO（Decoupled Calibration Policy Optimization）的目标是让模型在回答问题的同时，输出**校准的置信度**。

#### 什么是校准（Calibration）

如果模型说"我有 80% 的把握"，那么在所有它说 80% 把握的问题中，确实应该有约 80% 是正确的。

- **过度自信**：模型说 90% 把握，但实际只有 50% 正确率
- **校准良好**：模型说的置信度 ≈ 实际正确率

#### DCPO 的两个 Reward

DCPO 将训练信号分解为两部分：

| Reward | 公式 | 含义 |
|--------|------|------|
| Accuracy Reward | `1 if correct else 0` | 回答是否正确 |
| Calibration Reward | `weight × (hybrid_acc - confidence)²` | 置信度与准确率的偏差 |

其中：
```
hybrid_accuracy = α × sample_accuracy + (1-α) × group_mean_accuracy
```

- `α = 0.5`：混合当前样本的准确率和组平均准确率
- `confidence`：模型输出的置信度数值
- calibration reward 越小越好（偏差越小越好）

#### 为什么需要 Decoupled（解耦）

如果把两个 reward 简单相加再做 GRPO 归一化，会导致：
- accuracy 和 calibration 的量级不同，互相干扰
- 无法独立控制两个目标的学习速度

DCPO 的做法：**分别归一化，分别分配到不同的 token 位置**。

---

### 3.2 DCPO 在 Slime 中的实现

#### 3.2.1 Reward 计算

**文件**：`slime/rollout/rm_hub/dcpo_reward_post_process.py`

```python
def dcpo_reward_post_process(args, samples):
    # 1. 提取每个 sample 的 accuracy、confidence、char_pos
    
    # 2. 按 prompt 分组，计算 group_mean_accuracy
    
    # 3. 计算 calibration reward
    hybrid_acc = α * sample_acc + (1-α) * group_mean_acc
    cal_reward = weight * (hybrid_acc - confidence) ** 2
    
    # 4. 分别做 GRPO 归一化
    acc_advantages = _grpo_normalize(acc_tensor, group_indices)
    cal_advantages = _grpo_normalize(cal_tensor, group_indices)
    
    # 5. 存入 sample.train_metadata（传递给训练阶段）
    sample.train_metadata["dcpo_accuracy_advantage"] = acc_adv
    sample.train_metadata["dcpo_calibration_advantage"] = cal_adv
    sample.train_metadata["dcpo_confidence_char_pos"] = char_pos
```

#### 3.2.2 Advantage 构建：两个 Reward → 一个 per-token Advantage Tensor

**文件**：`slime/backends/megatron_utils/loss.py::compute_advantages_and_returns`（dcpo 分支）

DCPO 的核心是在 **reward 后处理阶段** 计算两个独立的标量 advantage，然后在 **advantage 构建阶段** 按位置分配到一个 tensor 中。

**第一阶段：两个标量 advantage（Ray 侧，`dcpo_reward_post_process.py`）**

```python
# 对每个样本，分别归一化
acc_advantages[i] = (acc_reward[i] - group_mean_acc) / group_std_acc
cal_advantages[i] = (cal_reward[i] - group_mean_cal) / group_std_cal

# 存入 train_metadata
sample.train_metadata["dcpo_accuracy_advantage"] = acc_advantages[i]    # 标量
sample.train_metadata["dcpo_calibration_advantage"] = cal_advantages[i]  # 标量
sample.train_metadata["dcpo_confidence_char_pos"] = char_pos             # 字符位置
```

**第二阶段：按 token 位置分配（Megatron 侧，`compute_advantages_and_returns`）**

```python
# 从 train_metadata 读取预计算的 advantage（标量）
acc_adv = meta["dcpo_accuracy_advantage"]    # e.g., 0.5
cal_adv = meta["dcpo_calibration_advantage"]  # e.g., -0.3
char_pos = meta["dcpo_confidence_char_pos"]

# 将字符位置转换为 token 位置 conf_pos
# （通过 tokenizer decode 逐 token 累加字符长度来定位）

# 按位置分配 advantage
adv = torch.zeros(seq_len)
adv[:conf_pos] = acc_adv        # reasoning tokens: accuracy advantage
adv[conf_pos:] = -cal_adv       # confidence tokens: -calibration advantage
```

**具体示例**：假设一个 response 有 500 个 token，其中"CONFIDENCE: 0.72<|im_end|>" 从第 493 个 token 开始（`conf_pos = 493`），`acc_adv = 0.5`，`cal_adv = -0.3`：

```
token 位置:    0   1   2  ... 492  493 494 495 496 497 498 499
              ├─── reasoning ───┤├── confidence ──────────────┤
advantage:   [0.5 0.5 0.5 ... 0.5  0.3 0.3 0.3 0.3 0.3 0.3 0.3]
                                    ↑
                              -cal_adv = -(-0.3) = 0.3
```

- 前 493 个 token（reasoning 区域）：advantage = 0.5（accuracy advantage）
- 后 7 个 token（confidence 区域）：advantage = 0.3（-calibration advantage）

**两个 advantage 是如何 "合并" 的？** 它们不是相加，而是**分区赋值**——同一个 token 位置只有一个 advantage 值。这就是"Decoupled"的含义：accuracy 信号只作用于 reasoning token，calibration 信号只作用于 confidence token，互不干扰。

**模型未输出 CONFIDENCE 时的处理**：

| 模式 | `char_pos=None` 时的 `conf_pos` | reasoning 区域 | confidence 区域 | 备注 |
|------|-------------------------------|---------------|----------------|------|
| DCPO（不用 SFT） | `max(1, seq_len-2)` → 最后 2 个 token | `adv[:conf_pos] = acc_adv` | `adv[conf_pos:] = -cal_adv` | 粗糙 fallback，可能惩罚推理 token |
| DCPO+SFT | `seq_len` → 整个 response | `adv[:] = acc_adv` | 空 | SFT mask 全零，不监督；该样本完全走 GRPO |

#### 3.2.3 为什么 Calibration Advantage 要取负

这是理解 DCPO 的关键点。

**Calibration reward = (hybrid_acc - confidence)²**

经过 GRPO 归一化后：
- 误差**大于**组平均的样本 → `cal_adv > 0`
- 误差**小于**组平均的样本 → `cal_adv < 0`

在 PPO loss 中：
```
loss = -ratio × advantage
```
- `advantage > 0` → 模型增加该 token 的概率
- `advantage < 0` → 模型降低该 token 的概率

**如果不取负**：
- 误差大的样本 `cal_adv > 0` → 模型会**增加**这些 confidence token 的概率
- 这意味着模型会强化"产生大误差的置信度输出"，方向完全反了！

**取负后**：
- 误差大的样本 `-cal_adv < 0` → 模型**降低**这些 confidence token 的概率
- 误差小的样本 `-cal_adv > 0` → 模型**增加**这些 confidence token 的概率
- 效果：鼓励模型输出校准误差小的置信度

#### 3.2.4 Loss 计算

DCPO 的 advantage 构建完成后，直接复用 GRPO 的 `compute_policy_loss`：

```python
# 统一的 advantage tensor 已经包含了 accuracy 和 calibration 信息
pg_loss, pg_clipfrac = compute_policy_loss(ppo_kl, advantages, eps_clip, eps_clip_high)
```

不需要额外的 loss 分支。整个 DCPO 的特殊性都体现在 **advantage 的构建方式**上。

---

### 3.3 运行 DCPO

相比标准 GRPO 脚本，需要修改以下参数：

```bash
GRPO_ARGS=(
   --advantage-estimator dcpo          # 改为 dcpo
   # ... 其他参数不变
)

ROLLOUT_ARGS=(
   --rm-type dcpo                       # 使用 dcpo reward function
   --custom-reward-post-process-path \
       slime.rollout.rm_hub.dcpo_reward_post_process.dcpo_reward_post_process
   # ... 其他参数不变
)
```

可选的 DCPO 特有参数：
- `--dcpo-calibration-weight 0.5`：calibration reward 的权重
- `--dcpo-hybrid-alpha 0.5`：hybrid accuracy 中 sample_acc 的权重

#### 3.3.1 DCPO 特有日志字段

DCPO 在标准日志之外额外记录以下指标：

| 字段 | 含义 | 出现位置 | 数据来源 |
|------|------|---------|---------|
| `rollout/dcpo/accuracy` | 平均 accuracy | Ray 侧 (类型 1, 2) | `sample.metadata["dcpo_accuracy"]` |
| `rollout/dcpo/confidence` | 平均 confidence | Ray 侧 (类型 1, 2) | `sample.metadata["dcpo_confidence"]` |
| `rollout/dcpo/calibration_reward` | 平均 `(hybrid_acc - conf)^2` | Ray 侧 (类型 1, 2) | 在 `compute_metrics_from_samples` 内现算 |
| `rollout/dcpo/confidence_output_ratio` | 输出 CONFIDENCE 的比例 | Ray 侧 (类型 1, 2) | `confidence != -1.0` 的比例 |
| `rollout/dcpo_accuracy` | 平均 accuracy | Megatron 侧 (类型 4) | `rollout_data["metadata"]` |
| `rollout/dcpo_calibration_reward` | 平均 calibration reward | Megatron 侧 (类型 4) | `rollout_data["metadata"]` |
| `rollout/dcpo_confidence` | 平均 confidence | Megatron 侧 (类型 4) | `rollout_data["metadata"]` |
| `rollout/dcpo_confidence_output_ratio` | 输出 CONFIDENCE 的比例 | Megatron 侧 (类型 4) | `confidence != -1.0` 的比例 |

> **注意**：Ray 侧的 DCPO 指标前缀是 `dcpo/`（在 `compute_metrics_from_samples` 中定义，外层再加 `rollout/` 或 `eval/`），Megatron 侧的 DCPO 指标前缀是 `dcpo_`（无斜杠，在 `log_rollout_data` 中定义，外层加 `rollout/`）。两者数值来源相同，只是聚合时机不同。

---

## 第四部分：FAQ

### 4.1 On-policy 策略

**Q：Slime 默认是 on-policy（一轮 rollout 数据只更新一次），为什么有的场景需要多步更新？**

A：
- **采样效率**：rollout 是最耗时的环节，如果数据只用一次就丢掉太浪费
- **学习充分性**：多步小更新可能比一步大更新学得更好
- **权衡**：多步更新会引入 off-policy 偏差，如果计算资源充足（采样不是瓶颈），on-policy 更好

**Q：如何设置多步更新？**

A：设置 `global_batch_size < rollout_batch_size × n_samples_per_prompt`，使得 `num_steps_per_rollout > 1`。

---

### 4.2 Partial Rollout 与 On-policy 性

**Q：开启 partial rollout 后，buffer 中的数据是上一轮模型生成的，会不会破坏 on-policy？**

A：在 rollout 的时候，当数据满足需求时，可能还会有一些数据正在推理中。Slime 提供了 `args.partial_rollout`（默认 False）选项。当需求满足时，slime 会执行 abort 操作打断正在推理中的数据。如果 `partial_rollout=True`，就会收集这些数据加到 data buffer 中。下次 rollout 取数据时优先取 buffer 中的。

但是和上一次 rollout 之间模型隔了一次参数更新。这些部分推理的数据已有的 response 片段是更新前的模型生成的。

Slime 通过 `--mask-offpolicy-in-partial-rollout` 来处理：

```python
# 对 buffer 中的数据，mask 掉上一轮模型生成的部分
if args.partial_rollout and args.mask_offpolicy_in_partial_rollout:
    sample.loss_mask = [0] * sample.response_length  # 旧模型生成的部分不计算 loss
```

这样保证了"动作采样"的 on-policy 性（只对当前模型生成的 token 计算 loss），但"状态分布"上是 off-policy 的（prompt 后面跟的是旧模型的 response 前缀）。一次模型更新只用到了自己 rollout 的部分，虽然一次 response 是由两个模型完成的，但对计算梯度的部分保证了 on-policy 性。工程上为了加速，这样是可接受的。

---

### 4.3 自定义 Reward Function

**Q：我该在哪里改 reward function？如果我的 reward 是多个指标的组合，怎么分别记录每个 sub_reward？**

A1：reward function 在 `slime/rollout/rm_hub/__init__.py` 中。可以通过修改现有的 reward 计算函数，也可以自己定义然后提供函数路径，通过 `--rm-type` 来切换。

A2：如果想记录多个 reward 指标，可以：
1. 修改 `Sample` 类，增加额外字段（如 `acc_reward`、`conf_reward`）
2. 在 reward function 中返回 dict，然后在 `generate_and_rm` 中分别赋值
3. 在 `compute_metrics_from_samples` 中添加对应的统计

```python
# 在 sglang_rollout.py 的 generate_and_rm 中
if 'conf' in args.rm_type:
    reward_dict = await async_rm(args, sample)
    sample.reward = reward_dict['total_reward']      # 用于训练
    sample.acc_reward = reward_dict['acc_reward']     # 用于追踪
    sample.conf_reward = reward_dict['conf_reward']   # 用于追踪
else:
    sample.reward = await async_rm(args, sample)
```

---

### 4.4 常见问题

**Q：单卡训练 OOM**

A：检查以下配置：
- `max_tokens_per_gpu` 必须 **大于** `rollout_max_response_len`
- 否则超长序列会独占一个 batch，超出 GPU 容量
- 降低 `sglang-mem-fraction-static`（训推一体化时 Megatron 初始化占显存）
- 错误设置示例：`rollout-max-response-len(8192) > max_tokens_per_gpu(4096)`，对于很长的序列默认不会过滤，只会单独作为一个 batch 存在，这会超出一个 GPU 的容纳量

**Q：`pg_clipfrac = 0` 是什么意思？**

A：说明是纯 on-policy 训练，ratio ≈ 1，clip 没有生效。这是正常的。

**Q：`train/ppo_kl = 0` 是什么意思？**

A：说明 old_log_probs 和 new_log_probs 完全相同（on-policy 第一次 forward）。正常。

**Q：TIS（Truncated Importance Sampling）是做什么的？**

A：当 importance ratio 极大时（说明数据已经严重 off-policy），TIS 会压低或丢弃这些样本的梯度，防止模型被无效数据带偏。PPO 的 clip 只是限制更新幅度，TIS 是直接判断"这个数据还能不能用"。

**Q：`train_rollout_logprob_abs_diff` 是什么？**

A：训练 backend（Megatron forward）和推理 backend（SGLang）计算的 log_prob 之间的绝对差异。理论上应该为 0，但由于数值精度、实现差异等原因会有微小差异。如果这个值很大，说明训推不一致，需要排查。

---

## 附录

### A. 完整运行脚本示例

```bash
#!/bin/bash

pkill -9 sglang; sleep 3
ray stop --force; pkill -9 ray; pkill -9 python
sleep 3; pkill -9 ray; pkill -9 python

set -ex
export PYTHONBUFFERED=16

# === 基本配置 ===
bt_size=256                                          # 每轮采样的 prompt 数
sample_num_per_prompt=8                              # 每个 prompt 生成的 response 数
global_batch_size=$((bt_size * sample_num_per_prompt))  # 一次更新的样本量（= rollout 总量 → on-policy）

SCRIPT_DIR="/data/users/nishiyu/code/slime/slime"
source "${SCRIPT_DIR}/scripts/models/qwen3-8B.sh"

# === 模型路径 ===
CKPT_ARGS=(
   --hf-checkpoint /data/models/Qwen3-8B              # tokenizer 路径
   --ref-load /data/models/Qwen3-8B_torch_dist/       # ref model（Megatron 格式）
   --save /data/models/output/                        # 模型保存路径
   --save-interval 40                                 # 每 40 步保存一次
)

# === Rollout 配置 ===
ROLLOUT_ARGS=(
   --prompt-data /data/datasets/train.jsonl
   --input-key prompt
   --label-key label
   --apply-chat-template
   --rollout-shuffle
   --rm-type math                                     # reward 类型
   --num-rollout 2000                                 # 总训练轮数
   --rollout-batch-size ${bt_size}
   --n-samples-per-prompt ${sample_num_per_prompt}
   --rollout-max-response-len 3000
   --rollout-temperature 1
   --global-batch-size ${global_batch_size}
)

# === 评估配置 ===
EVAL_ARGS=(
   --eval-interval 20
   --eval-prompt-data aime24 /data/datasets/aime-2024.jsonl
   --n-samples-per-eval-prompt 1
   --eval-max-response-len 16384
   --eval-top-k 1
)

# === 并行配置 ===
PERF_ARGS=(
   --tensor-model-parallel-size 1
   --sequence-parallel
   --pipeline-model-parallel-size 1
   --context-parallel-size 1
   --use-dynamic-batch-size
   --max-tokens-per-gpu 9216                          # 必须 > rollout-max-response-len
)

# === GRPO 配置 ===
GRPO_ARGS=(
   --advantage-estimator grpo
   --use-kl-loss
   --kl-loss-coef 0.01                                # KL loss 权重（0 = 不约束）
   --kl-loss-type low_var_kl
   --kl-coef 0.00                                     # reward 中的 KL（GRPO 不需要）
   --entropy-coef 0.00
   --eps-clip 0.2
   --eps-clip-high 0.28
)

# === 优化器 ===
OPTIMIZER_ARGS=(
   --optimizer adam
   --lr 1e-6
   --lr-decay-style constant
   --weight-decay 0.1
   --adam-beta1 0.9
   --adam-beta2 0.98
)

# === 日志 ===
TENSORBOARD_ARGS=(
   --use-tensorboard
   --tb-project-name MyProject
   --tb-experiment-name experiment_1
   --tensorboard-dir /data/tensorboard
)

# === SGLang 推理引擎 ===
SGLANG_ARGS=(
   --rollout-num-gpus-per-engine 1
   --sglang-mem-fraction-static 0.7
   --sglang-enable-deterministic-inference
   --sglang-attention-backend flashinfer
   --deterministic-mode
   --sglang-chunked-prefill-size 4096
   --sglang-max-running-requests 128
)

# === 其他 ===
MISC_ARGS=(
   --attention-dropout 0.0
   --hidden-dropout 0.0
   --accumulate-allreduce-grads-in-fp32
   --attention-softmax-in-fp32
   --attention-backend flash
)

# === 启动 ===
ray start --head --node-ip-address 127.0.0.1 --num-gpus 4 --num-cpus 32 --disable-usage-stats

ray job submit --address="http://127.0.0.1:8265" \
   --runtime-env-json='{
     "env_vars": {
        "PYTHONPATH": "/root/Megatron-LM",
        "CUDA_DEVICE_MAX_CONNECTIONS": "1",
        "NCCL_ALGO": "Ring",
        "NVTE_ALLOW_NONDETERMINISTIC_ALGO": "0",
        "CUBLAS_WORKSPACE_CONFIG": ":4096:8"
     }
   }' \
   -- python3 train.py \
   --actor-num-nodes 1 \
   --actor-num-gpus-per-node 4 \
   --colocate \
   --calculate-per-token-loss \
   --use-slime-router \
   ${MODEL_ARGS[@]} \
   ${CKPT_ARGS[@]} \
   ${ROLLOUT_ARGS[@]} \
   ${OPTIMIZER_ARGS[@]} \
   ${GRPO_ARGS[@]} \
   ${TENSORBOARD_ARGS[@]} \
   ${PERF_ARGS[@]} \
   ${EVAL_ARGS[@]} \
   ${SGLANG_ARGS[@]} \
   ${MISC_ARGS[@]}
```

### B. Slime 核心函数索引

| 功能 | 文件路径 | 函数名 |
|------|---------|--------|
| 数据源 | `slime/rollout/data_source.py` | `RolloutDataSourceWithBuffer` |
| Rollout 生成 | `slime/rollout/sglang_rollout.py` | `generate_rollout_async` |
| Reward 计算 | `slime/rollout/rm_hub/__init__.py` | `async_rm` |
| 按 DP 切分 | `slime/ray/rollout.py` | `_split_train_data_by_dp` |
| 切分 micro-batch | `slime/backends/megatron_utils/data.py` | `get_data_iterator` |
| Advantage 计算 | `slime/backends/megatron_utils/loss.py` | `compute_advantages_and_returns` |
| Policy Loss | `slime/utils/ppo_utils.py` | `compute_policy_loss` |
| 总 Loss | `slime/backends/megatron_utils/loss.py` | `policy_loss_function` |
| 训练循环 | `slime/backends/megatron_utils/model.py` | `train` / `train_one_step` |
| 日志记录 | `slime/ray/rollout.py` | `compute_metrics_from_samples` |
| KL 估计 | `slime/utils/ppo_utils.py` | `compute_approx_kl` |
| GAE | `slime/utils/ppo_utils.py` | `vanilla_gae` |
