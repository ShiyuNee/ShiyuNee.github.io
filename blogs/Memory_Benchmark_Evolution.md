---
permalink: /blogs/Memory-Benchmark-Evolution/
title: "Memory Benchmark 演化"
layout: single
author_profile: true
---

{::options toc_levels="1-4" /}

**目录**

* TOC
{:toc}

> 核验日期：2026-08-04<br>
> 本文严格区分三个层次：**论文定位**依据 Introduction，说明作者认为既有工作没有评测什么；**核心研究问题 / 想揭示什么**说明论文真正希望检验的现象、失败模式或结论；**具体特色**依据 contribution 和正文，说明作者如何通过数据、任务和监督把这个问题变成可评测对象。数据构造与评测流程以论文正文和 Appendix 为准；官方 GitHub / Hugging Face 主要用于核验公开版本、数据规模和真实案例。表中还重点比较：评测时历史是预先给定还是由当前模型在线产生；任务是纯对话、离线 Agent trajectory 理解，还是实际 Agent 环境执行；以及数据监督只能评价最终结果，还是能够诊断 memory lifecycle 的具体环节。
> 表中的发表时间统一指论文**首次在 arXiv 公开的日期**，不与后续会议接收或正式出版时间混用。

---

# 1. 快速总览

| Benchmark | 发表时间 | 论文定位：既有工作缺什么 | 核心研究问题 / 想揭示什么 | 具体特色：如何把问题变成 Benchmark | 评测时的历史 / 轨迹来源 | 场景形态：纯对话还是 Agent 场景 | 模型任务 | 关键监督与评测粒度 |
|---|---|---|---|---|---|---|---|---|
| **LoCoMo** | 2024-02-27 | 既有长期开放域对话通常只覆盖少量 sessions 和较短历史；常规对话生成指标也不能直接判断模型是否真正记住了跨 session 的事实、时间和因果关系。 | 模型在数月跨度、包含图片和人物事件的开放域对话中，是否仍能保持长期一致理解？长上下文或 RAG 的流畅回复是否可能掩盖事实遗忘、时间混淆和因果错误？ | 构建跨数月、多 session、含图片的长期对话，以 temporal event graph 控制事件关系，并联合 QA、事件总结和后续对话生成，从多个角度检查长期记忆。 | **给定预先生成并人工修订的固定多-session对话** | 纯对话（含图像；无工具或环境执行） | QA、事件总结、后续对话生成 | Answer、evidence turns、event summary 和后续回复 reference；主要评价最终理解与生成，不能直接诊断内部 memory operation。 |
| **LongMemEval** | 2024-10-14 | 既有 benchmark 不能充分反映长期 user–AI、task-oriented interaction，历史较短且不可扩展；也缺少 Assistant-side information、跨 session 推理、时间推理、知识更新和拒答。 | 聊天助手是否能在持续增长、动态变化的交互历史中正确保留和使用信息？当最终回答失败时，问题究竟来自 memory 的表示、检索，还是对取回内容的阅读和综合？ | 围绕 500 个问题构造可扩展、带时间戳的 user–assistant history，提供答案与 evidence 监督，并以 indexing–retrieval–reading 三阶段分析不同 memory design。 | **给定预先构造的固定长期对话**，按 session 顺序输入 | 纯对话（任务型聊天；无工具执行） | 最终 QA；可输出 retrieval result | Answer / rubric 与 session-/turn-level evidence；可分别评价 QA 和 retrieval，但没有 gold indexing / writing operation。 |
| **MemBench** | 2025-06-20 | 既有工作主要评测显式给出的 factual memory，忽略由多条行为和事实隐式归纳出的**高层 reflective memory**，例如 user preference；也主要考虑 Agent 直接参与的对话，忽略**第三人称** observation，并且往往**只报告准确率**。 | Memory system 是否不仅能记住“用户说过什么”，还能从多个低层行为中推断“用户是什么样的人、偏好什么”？当 Agent 只是观察第三方消息而非亲自参与时，记忆能力是否仍然成立？准确率提升是否以更高延迟和容量为代价？ | 以 factual / reflective × participation / observation 形成四类设置，并同时评价 effectiveness、efficiency 和 capacity，使高层记忆、第三方观察和系统成本可以被统一比较。 | **给定预先构造的固定对话或第三方消息 / 行为流** | 对话 / 第三方消息观察（无工具执行） | Factual / reflective multiple-choice QA | Gold answer 与对应事实 / 偏好目标；主要评价 QA，部分设置评价 retrieval、效率和容量，不监督具体 memory operation。 |
| **MemoryAgentBench** | 2025-07-07 | 一般 Agent benchmark 重点评价 reasoning、planning 和 tool use，长上下文 benchmark 又常一次性提供完整 context；现有 memory benchmark 没有在**增量交互**中统一覆盖多种 memory 能力。 | 一个在事实检索上表现好的 memory system，是否也能进行 test-time learning、理解整体长程内容并正确处理冲突信息？是否存在真正通用的 memory architecture，而不是只适合某一类任务？ | 将长文、对话、示例和冲突事实切成 incremental multi-turn chunks，统一评测 Accurate Retrieval、Test-Time Learning、Long-Range Understanding 和 Selective Forgetting。 | **给定预先准备并切分的固定 chunks** | 文本、对话或示例流（非在线环境 Agent） | QA、分类、推荐或总结 | 继承各来源任务的 answer、label、preference target 或 summary keypoints；主要评价四类能力的下游表现，没有统一 gold memory。 |
| **MemoryBench** | 2025-10-20 | 既有 memory benchmark 主要从静态 semantic / episodic history 中检索 declarative information，不能评价系统是否能**从 test-time 用户反馈中学到“以后应该怎样回答或行动”。** | 用户的显式纠正、满意度和后续行为能否被转化为 procedural memory，并持续改善未来任务？这种学习是否会带来高成本、跨任务干扰或遗忘？ | 构建 Task Provider–LLM System–User Simulator–Performance Monitor 框架，让系统在服务期接收显式或隐式反馈，再在 held-out tasks 上评价持续改进、成本和稳定性。 | **在线生成 feedback 或直接给定预生成 service logs；主文结果默认采用 off-policy** | 服务式对话与反馈学习（无外部工具环境） | 利用反馈更新系统，再完成 held-out tasks | 原任务 label、显式 / 隐式反馈及 held-out labels；评价持续学习效果，但不提供唯一的 gold procedural memory。 |
| **Mem2ActBench** | 2026-01-13 | 既有 Question → Retrieval → Answer 任务通常已经明确告诉模型需要查找什么事实，不能测试**欠指定请求中主动识别缺失约束并把 memory 用于 action 的能力**。 | Agent 能否先发现当前请求缺少哪些参数，再从长期历史中恢复正确实体、状态和偏好，并准确绑定到 tool arguments？失败究竟来自没有检索到信息，还是找到了却没有正确 grounding 到 action？ | 使用 Fact Evolution Chain 组织实体和属性演化，反向构造省略参数的请求，并提供 gold tool call 与 argument grounding，从而区分 retrieval 和 parameter grounding failure。 | **给定预先构造的固定多-session对话** | 对话 → 单次 tool call（只生成，不执行） | 从欠指定请求恢复参数，输出一次 tool call | Gold tool call、arguments、Fact Evolution Chain 与参数 grounding；可评价 action correctness，并区分 retrieval 与 grounding failure。 |
| **MemoryArena** | 2026-02-18 | 静态 memory benchmark 多做 post-hoc recall，缺少 decision-making、environment change 和 action consequence；Agent benchmark 又多为单 session 或彼此独立的任务。 | Memory 是否真的能帮助 Agent 完成后续环境任务，而不仅是回答关于过去的问题？错误或不完整的 memory 是否会跨 session 累积，并反过来伤害后续决策？ | 构造跨 session、因果依赖的 task groups，由当前 Agent 在线执行；前面 action、environment feedback 和中间结果会改变后续任务条件，最终以 task progress 和 group success 衡量 memory utility。 | **当前被测 Agent 在线执行并形成自己的轨迹** | Agent 环境执行（action–observation，在线） | 连续完成相互依赖的环境 subtasks | 任务目标、约束、预期结果和环境 verifier；评价 subtask progress 与 group success，但没有唯一 gold memory。 |
| **AMA-Bench** | 2026-02-26 | 以聊天为中心的 benchmark 不能覆盖 **Agent trajectory** 中的机器生成表示、action 引起的隐式状态变化以及更高的信息密度。 | Memory system 能否理解 Agent 做了什么、为什么导致当前状态，以及多个 action 累积后的抽象状态，而不仅是从轨迹中检索一条显式事实？ | 收集多领域真实 Agent trajectories，并在可控环境中程序生成合成轨迹，围绕 Recall、Causal Inference、State Updating 和 State Abstraction 构造 trajectory QA。 | **给定预先采集或程序生成完成的固定 Agent trajectory** | Agent trajectory 理解（离线读取，不执行） | 轨迹后回答事实、因果和状态问题 | QA answer 与 ability type；主要评价 trajectory QA，不评价当前 Agent 的执行成功或完整 memory lifecycle。 |
| **AMemGym** | 2026-03-02 | 固定 off-policy history 不能反映当前 Assistant 的回复如何改变用户后续表达，并可能产生 reuse bias；纯用户模拟又难以同时保证状态可控、对话自然和不同系统可比较。 | **在当前 Assistant 自己参与形成的历史上**，memory method 的表现和固定历史评测是否一致？失败是没有写入用户状态、无法取回，还是取回后没有真正用于回复？ | 以结构化 persona、离散 user state 和预设 evolution 控制环境，同时让当前 Assistant 与用户模拟器在线 role-play，并通过周期 QA 及 Write、Read、Utilization probes 进行诊断。 | **当前 Assistant 与用户模拟器在线生成自己的历史** | 纯对话（用户模拟，在线） | 持续回复，并在周期 checkpoint 回答个性化问题 | 隐藏 user state、state updates 和 state-conditioned reference answers；可诊断 Write、Read、Utilization，但不是逐条 gold memory operation。 |
| **MedMemoryBench** | 2026-05-12 | 通用对话或 Agent memory benchmark 不能覆盖医疗中的安全关键个性化、纵向疾病进展、流式 memory integration 和持续噪声累积。 | 系统能否长期保留过敏、禁忌症等高风险事实，正确跟踪疾病和用药状态，并在大量无关或代问信息持续进入后仍保持可靠？更多 memory 是否可能造成 memory saturation，反而降低医疗回答质量？ | 构建专家验证的长期患者轨迹与 clinical event graph，注入 trap events，并采用 evaluate-while-constructing 和 Efficient / Mixed 设置，周期性评价事实、更新、临床推理和噪声鲁棒性。 | **给定预先生成并经专家审核的固定对话**，按时间流式输入 | 医疗对话（无临床工具执行） | 多 checkpoint 医疗 QA | Answers / explanations、source key points、clinical events 与 trap events；评价事实、更新、临床推理和噪声鲁棒性，不直接监督 memory operation。 |
| **LongMemEval-V2** | 2026-05-12 | 既有长期 memory 多关注文档或聊天；trajectory benchmark 常依赖简化游戏、单条或少量轨迹，或只通过下游成功率间接评价 memory；AMA-Bench 主要在单条长轨迹上提问。 | **Agent memory 能否从数百条彼此独立的历史任务中逐渐积累可复用的 environment-specific knowledge**，像有经验的同事一样理解工作流、界面状态和环境陷阱？瓶颈来自 context gathering 还是 Reader？ | 从 WebArena / WorkArena 系列历史任务中构造环境知识问题，要求 memory 批量 Insert 大量轨迹、Query 紧凑 context，再由固定 Reader 回答，从而尽量分离 memory 和 reader。 | **给定预先采集的大量固定网页轨迹** | 网页 Agent trajectory 知识问答（离线读取） | Insert 轨迹，Query context，由固定 Reader 回答 | 当前公开版主要提供 question / answer 与评测函数；主要评价 environment knowledge QA 和 latency，不能直接计算 gold trajectory retrieval recall。 |
| **EvoMemBench** | 2026-05-18 | 文本 memory benchmark 偏向 knowledge retention，Agent / lifelong 工作又没有同时覆盖 in-episode / cross-episode 与 knowledge / execution，缺少统一、可复现的比较。 | **不同 memory form 究竟适合什么任务**？在当前 episode 保存事实，与跨 episode 积累知识或执行经验，是否需要不同机制？是否存在对所有 scope 和 content 都有效的通用 memory？ | 提出 scope × content 二维 taxonomy，组织六个知识、工具、搜索和具身任务，并在统一协议下比较多类 memory methods 的适用范围。 | **依子任务而异：固定输入与在线 episodes 并存** | 混合：文本 QA + 工具 / Web / 具身 Agent | QA、tool call、搜索或具身 action | 继承各来源任务的 answer、gold tool call 或环境 verifier；评价不同 scope / content 下的下游表现，没有统一 memory 标注。 |
| **MemGym** | 2026-05-20 | 真实 Agent task success 同时混合 reasoning、tool use 和 memory；很多任务中的信息还可以重新从环境发现，未必真正需要长期 memory，而完整 rollout 又成本很高。 | 观察到的性能提升究竟来自 memory，还是更强 reasoning、工具能力或重新发现信息？一个任务是否真的存在 memory pressure，**memory 带来的边际贡献有多大**？ | 统一工具、代码、网页和研究任务，使用 memory / no-memory paired comparison、replay-and-fork 和 ablation 验证 memory pressure，并训练 MemRM 近似昂贵的 rollout reward。 | **在线、replay-and-fork 与固定合成历史并存** | 混合：在线工具 / 代码 / 网页 / 搜索 + 固定 QA / 回放 | 在相同 reasoner 下比较有 / 无 memory 的任务结果 | 环境 verifier、tests / hidden patch，以及 memory-only facts / bridge chains；主要评价 memory 的边际贡献。 |
| **WorldMemArena** | 2026-05-28 | 既有工作多只看最终 QA，**不能区分 writing、maintenance、retrieval 和 use**；主要是文本或 image caption，缺少原生多模态 evidence，也缺少对 self-managing memory 的完整诊断。 | 最终回答错误时，究竟是该写的内容没有写入、旧状态没有更新、检索错了，还是 evidence 已取回却没有正确使用？反过来，最终回答正确是否也可能掩盖中间 memory 状态或过程上的错误？ | 构建 Lifelong Evolution 与 Agentic Execution 多模态轨迹；每个 session 标注 Gold memory points、State updates 和 Distractors，每个问题标注 Evidence points 与 answer，因此可分别评价 writing、maintenance、retrieval 和 use。 | **给定预先收集并切分的固定多模态历史 / 轨迹** | 混合多模态对话与 Agent trajectory（离线输入） | 顺序写入、维护和检索 memory，再回答 checkpoint QA | Gold memory points、state updates、distractors、evidence points 和 answer；**能够对完整 memory lifecycle 进行最细粒度的分阶段评测**。 |
| **MemOps** | 2026-07-14 | 只看最终 QA 会混淆 trigger、target binding、update、forget 和 reflect 等错误；系统甚至可能偶然给出正确答案，但内部 memory state 已经错误或不安全。已有更新 / 遗忘任务也缺少显式 operation supervision。 | 最终答案正确是否真的意味着 memory 正确？系统是否在正确时机执行了正确 operation、绑定了正确对象，并得到正确 state？Operation-level 监督能否揭示被最终 QA 掩盖的 stale state、误删和无证据 reflection？ | 将 Remember、Update、Forget、Reflect 作为显式构造与监督单位，提供 operation、trigger、target、old/new value、state transition 和 provenance，并设计多类 probes 分别评价内部 memory 行为与最终答案。 | **给定预先构造的固定合成长对话** | 纯对话上的 memory operation 预测（无工具环境） | 输出 operation、target、state、provenance 或最终答案 | Gold operation trace、target、state transition、evidence provenance 与 expected answer；可直接揭示“最终答案正确但内部 state / operation 错误”的情况。 |

---

# 2. 横向对比：先明确 Benchmark 到底在评什么

> 下面使用两个相互独立的维度组织这些工作。第一部分区分**评测协议与任务闭环**：历史由谁生成、当前模型是否会改变后续输入，以及 action 是否真正作用于环境。第二部分区分**监督与诊断粒度**：数据只能判断最终任务是否成功，还是能够进一步定位 writing、retrieval、use 或具体 memory operation 的错误。两种维度不能混为一谈：一个 benchmark 可以是在线 Agent 环境，但只有任务结果监督；也可以使用固定历史，却具有非常细粒度的 memory lifecycle 标注。

## 2.1 按交互协议与任务闭环区分

| 评测范式 | 历史 / 轨迹如何产生 | 当前被测模型是否改变后续输入 | 是否真正执行工具或环境 action | 最终主要评什么 | 代表 Benchmark |
|---|---|---|---|---|---|
| **固定长期对话 / 文本** | 对话、消息、长文或示例在评测前已经构造完成，再按 turn、session 或 chunk 顺序输入 | 否；不同系统面对相同历史 | 否 | 长期事实回忆、跨 session 推理、状态更新、总结、分类或偏好归纳 | LoCoMo、LongMemEval、MemBench、MemoryAgentBench、MedMemoryBench、MemOps |
| **固定 Agent trajectory 后验评测** | 输入已经完成的 action–observation、GUI、网页或多模态 Agent 轨迹 | 否；被测系统不会重新进入原环境 | 否；只读取过去的执行轨迹 | 轨迹中的事实、因果、状态变化、环境知识或 memory lifecycle | AMA-Bench、LongMemEval-V2、WorldMemArena |
| **固定对话 → Action generation** | 给定固定长期对话、当前欠指定请求和工具 schema | 否 | **只生成 action，不实际执行** | Memory 是否被正确恢复并绑定到 tool name / arguments | Mem2ActBench |
| **On-policy Assistant 对话** | 当前 Assistant 与用户模拟器共同生成对话；用户状态演化由结构化蓝图控制 | **是**；Assistant 回复会影响用户后续的自然语言表达 | 否；Assistant 的 action 只是自然语言回复 | 在自身交互历史上，用户状态是否被写入、取回并用于个性化回答 | AMemGym |
| **用户反馈驱动的持续学习** | 在线模式下，系统回答后由用户模拟器生成反馈；也可直接使用预生成 service logs | 在线模式是；off-policy 模式否。论文主实验默认采用预生成日志 | 否；不是外部工具环境执行 | 系统能否把显式或隐式反馈转化为 procedural memory，并改善 held-out tasks | MemoryBench |
| **On-policy Agent 环境执行** | 当前 Agent 在线选择 action、接收 observation，并将结果带入后续 session | **是**；不同 Agent 会形成不同环境状态和中间结果 | **是** | Memory 是否真正改善后续决策、subtask progress 和整组任务成功率 | MemoryArena |
| **混合 Suite / Replay 协议** | 同一 benchmark 内同时包含固定输入、在线 episode、完整 rollout 或 replay-and-fork | 依具体子任务而异 | 依具体子任务而异 | 不同 memory form 的适用范围，或 memory 相对于 no-memory 的边际贡献 | EvoMemBench、MemGym |

阅读这张表时，需要把以下边界分清：

- **出现 Agent trajectory，不代表当前 Agent 在在线执行。** AMA-Bench、LongMemEval-V2 和 WorldMemArena 读取的是已经固定的轨迹；MemoryArena 才由当前 Agent 重新进入环境并产生自己的 action–observation history。
- **输出 tool call，不等于形成完整 Agent 闭环。** Mem2ActBench 已经从 QA 前进到 action generation，但工具不会执行，也没有后续 observation，因此不能研究错误 action 如何改变后续环境。
- **On-policy 对话与 On-policy Agent 执行不同。** AMemGym 中 Assistant 回复会影响后续用户表达，但底层用户状态按照预设蓝图演化；MemoryArena 中 action 会真实产生环境反馈和任务后果。

从研究问题上看，这些协议形成了一条逐渐增强的链条：

```text
固定历史上的记忆理解
→ 将记忆 grounding 到一次 action
→ 当前模型参与形成历史
→ action 改变环境并影响后续任务
```

但这不是简单的“越靠后越好”。固定历史更容易保证不同系统可比，并支持精细标注；在线环境更接近真实 utility，却更难区分失败究竟来自 memory、reasoning、planning 还是工具执行。

## 2.2 按监督粒度与可诊断能力区分

| 监督 / 评测层级 | 数据主要提供什么 | 能够回答什么 | 仍然不能可靠判断什么 | 代表 Benchmark |
|---|---|---|---|---|
| **最终答案或任务结果** | Gold answer、分类标签、summary reference、环境 verifier 或 task success | 使用 memory 后，最终回答或任务是否完成得更好 | 失败发生在写入、检索、更新、推理还是 action execution | MemoryAgentBench、MemoryBench、MemoryArena、AMA-Bench、LongMemEval-V2、EvoMemBench |
| **答案 + Evidence / Grounding** | Answer 以及支持答案的 turns、sessions、source facts、clinical events 或 argument grounding chain | 除最终正确性外，还能检查相关历史是否被找到，或 action 参数是否有正确依据 | 系统内部应形成怎样的 memory state，以及每次写入 / 更新是否正确 | LoCoMo、LongMemEval、MemBench、Mem2ActBench、MedMemoryBench |
| **隐藏状态条件监督** | 每个时期的真实用户 state、state update，以及不同 state 对应的 reference answer | 状态是否进入 memory、是否可被读出、是否真正用于最终回复 | 唯一正确的内部 memory 表示或逐条 operation trace | AMemGym |
| **Memory lifecycle 标注** | Gold memory points、state updates、distractors、retrieval evidence 和 answers | 分别评价 writing、maintenance、retrieval 与 use，定位最终错误来自哪个阶段 | 每一步应采取哪一个具体 Remember / Update / Forget / Reflect operation | WorldMemArena |
| **显式 Operation 标注** | Operation、trigger、target、old/new state、state transition 与 provenance | 直接检查操作是否触发正确、对象是否绑定正确、状态是否正确更新，以及是否出现误删或无证据 reflection | 这些内部操作是否最终改善真实环境中的长期任务 utility | MemOps |
| **Memory 边际效用监督** | 同一 reasoner 下 memory / no-memory 配对结果、replay 分支、environment verifier 与 memory-only facts | 任务是否真的存在 memory pressure，以及 memory 带来的增量收益有多大 | 具体是哪一种 memory entry 或 operation 导致了收益或损失 | MemGym |

这张表体现的不是单一的强弱排序，而是两种不同目标：

- **Utility-oriented evaluation** 关心 memory 最终有没有帮助任务。MemoryArena 和 MemGym 更接近这一目标，但通常难以精确定位内部失败。
- **Diagnosis-oriented evaluation** 关心 memory lifecycle 的哪一步出了问题。WorldMemArena 和 MemOps 提供更细监督，但使用的是固定历史，不能直接替代真实在线任务中的 memory utility。

因此，选择 benchmark 时应先明确研究问题：

| 想回答的问题 | 更合适的工作 |
|---|---|
| 长期对话中能否回忆、综合并更新用户信息？ | LoCoMo、LongMemEval、MedMemoryBench |
| 能否从行为中归纳偏好，或覆盖多种 memory ability？ | MemBench、MemoryAgentBench |
| 能否从历史恢复约束并生成正确 action？ | Mem2ActBench |
| 当前 Assistant 自己参与形成历史后，memory 是否仍然有效？ | AMemGym |
| Memory 是否真正帮助后续环境决策和任务执行？ | MemoryArena |
| 能否理解或积累 Agent trajectory 中的状态、因果和环境经验？ | AMA-Bench、LongMemEval-V2 |
| 能否从用户反馈形成可复用的 procedural memory？ | MemoryBench |
| 最终失败具体来自 writing、maintenance、retrieval、use 还是 operation？ | WorldMemArena、MemOps |
| 不同 memory form 在多种任务中何时有效，或 memory 的边际贡献是多少？ | EvoMemBench、MemGym |

---

# 3. 逐篇介绍

---

## 3.1 LoCoMo

**论文：** [Evaluating Very Long-Term Conversational Memory of LLM Agents](https://arxiv.org/abs/2402.17753)<br>
**官方仓库：** [snap-research/locomo](https://github.com/snap-research/locomo)<br>
**作者 Hugging Face：** [adymaharana/locomo](https://huggingface.co/datasets/adymaharana/locomo)（当前只有说明文件，实际数据以 GitHub 为准）

**发表时间：** 2024-02-27（首次 arXiv 公开）

### 一句话定位

LoCoMo 系统研究 LLM Agent 对 **very long-term、open-domain、multimodal dialogue** 的理解能力，通过超长期对话上的 QA、事件总结和后续对话生成，测试模型能否回忆并利用跨 session 的事实、时间和因果信息。

### 关注什么问题

作者指出，当时长期开放域对话工作通常只在不超过约五个 chat sessions、约 1K tokens 的范围内评测。即使长上下文模型和 RAG 已经发展起来，它们在**数月跨度、多 session、包含人物事件和图片的开放域对话**中是否仍能保持一致理解，并没有得到充分研究。

作者还认为，回复相似度、连贯性等常规对话指标不足以直接评价长期记忆。一个回复即使语言自然，也可能忘记过去事件；因此需要能够**直接检查事实回忆、时间与因果关系以及长期生成一致性的任务**。

### 核心贡献

1. 构建跨数月、包含多次会话和图片的超长期开放域对话；
2. 使用 temporal event graph 控制人物事件之间的时间与因果关系；
3. 提出三类互补任务：
   - QA：直接测试事实、时间和跨 session 推理；
   - Event summarization：恢复人物在长期对话中的主要事件；
   - Multimodal dialogue generation：检查模型能否在生成中正确利用历史与图片信息。

### 一个样本是什么

一条 LoCoMo 数据包含**两个角色在多个日期进行的完整长期对话**。每个 session 包含多轮消息，部分消息还附有图片、caption 和图片检索信息。对话完成后，同一条数据配有多道 QA、session summary 和角色事件总结。

评测模型读取的是已经生成并人工修订好的固定历史；它不会参与生成前序 sessions，也不会改变后续历史。

### 数据构造

1. **构造角色与事件。** 作者从 MSC 中选取 persona seed，再由 LLM 扩展角色背景，并生成跨 6–12 个月的 temporal event graph。事件图最多包含约 25 个事件，显式记录事件日期和部分因果联系。
2. **虚拟 Agent 生成对话。** 两个角色 Agent 依据 persona、事件图、先前对话 memory 和 reflection 持续生成多 session 对话，并在适合的位置加入通过图片搜索得到的视觉内容。
3. **人工修订。** 人工检查人物设定、跨 session 事实一致性、时间与因果关系、图片和文本的对应关系，并修正不自然或矛盾的内容。
4. **构造任务与标注。** 基于最终对话生成并审核 QA、事件总结以及对话生成评测所需的 reference。

### 数据规模与评测

论文初始数据包含 50 段对话，平均约 304.9 turns、19.3 sessions 和 9,209 tokens，最多 35 sessions。当前官方 GitHub 只发布其中 10 段最长、质量较高的对话，因此“论文规模”和“当前公开规模”需要区分。

QA 包含 single-hop、multi-hop、temporal、open-domain knowledge 和 adversarial 等类型；Event summarization 与事件图中的 reference events 比较；对话生成则评价回复质量及其对长期历史的利用。

### 评测方式与侧重点

- **评测时历史 / 轨迹来源：** 给定预先生成并人工修订的固定超长期多模态对话；当前被测模型不参与形成这些历史。
- **模型任务：** QA、事件总结和后续对话生成。
- **关键监督 / 标注：** QA 提供标准答案及 evidence dialogue turns；事件总结提供角色事件 reference；对话生成使用真实后续回复及相关图像信息作为参考。
- **主要评测目标与粒度：** 评价最终事实回忆、跨 session / 时间推理、事件恢复和生成一致性。Evidence 标注可以说明答案依赖的位置，但没有 gold memory state 或 operation，不能诊断系统内部怎样写入、更新或读取 memory。
- **是否属于 Agent 执行评测：** 否。虽然数据由虚拟角色 Agent 生成，评测对象仍是固定对话上的理解与生成。
- **论文定位（Introduction 中的既有缺口）：** 既有长期开放域对话通常只覆盖少量 sessions 和较短历史；常规对话生成指标也不能直接判断模型是否真正记住了跨 session 的事实、时间和因果关系。
- **核心研究问题 / 想揭示什么：** 模型在数月跨度、包含图片和人物事件的开放域对话中，是否仍能保持长期一致理解？长上下文或 RAG 的流畅回复是否可能掩盖事实遗忘、时间混淆和因果错误？
- **具体特色（本文如何解决）：** 构建跨数月、多 session、含图片的长期对话，以 temporal event graph 控制事件关系，并联合 QA、事件总结和后续对话生成，从多个角度检查长期记忆。

### 主要结论

长上下文和 RAG 方法能够提高表现，但在需要跨大量 sessions 聚合、精确时间推理和长期生成一致性时仍存在明显困难。论文也显示，仅扩大上下文窗口并不能稳定解决超长期对话理解。

### 代表性 Case

官方数据中有一道问题询问 Caroline 何时参加 LGBTQ support group：

- Gold answer：`7 May 2023`
- Evidence：`D1:3`

另一个问题统计 Melanie 在 2023 年去了几次海滩：

- Gold answer：`2`
- Evidence 分布在 `D10:8` 和 `D6:16`

后者体现了跨 session 聚合，而不只是单条事实定位。

---

## 3.2 LongMemEval

**论文：** [LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory](https://arxiv.org/abs/2410.10813)<br>
**官方仓库：** [xiaowu0162/LongMemEval](https://github.com/xiaowu0162/LongMemEval)<br>
**官方数据：** [xiaowu0162/longmemeval-cleaned](https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned)

**发表时间：** 2024-10-14（首次 arXiv 公开）

### 一句话定位

LongMemEval 是一个面向聊天助手长期交互记忆的综合、困难且可扩展的 benchmark。它包含 500 个经过人工筛选和修改的问题，将回答所需信息嵌入带时间戳、长度可扩展的 user–assistant chat history 中，评测信息提取、跨 session 推理、时间推理、知识更新和拒答五项能力。

### 关注什么问题

作者认为已有 benchmark 有两类不足。

**第一，数据不能充分反映长期 user–AI interaction**。论文将 MSC、LoCoMo 和 DialSim 等工作视为主要模拟人—人式对话；部分其他数据又缺少 task-oriented dialogue。已有历史通常只有几千 tokens，而且长度固定，不能随着 memory system 能力提升继续扩展难度。

**第二，现有任务对长期记忆能力覆盖不完整**。MemoryBank 和 PerLTQA 没有充分测试跨大量 sessions 的信息综合和时间推理；包括 LoCoMo 在内的已有 benchmark，也没有测试对 Assistant 先前提供的信息的回忆，以及用户信息更新后能否根据最新状态回答。

### 核心贡献

LongMemEval 构建 500 个高质量问题，覆盖：

1. **Information Extraction**：从长历史中回忆用户或 Assistant 提供的具体信息；
2. **Multi-Session Reasoning**：综合多个 sessions 中的信息；
3. **Temporal Reasoning**：结合对话中的时间表达和 session timestamp；
4. **Knowledge Updates**：用户状态变化后使用最新信息；
5. **Abstention**：历史中没有答案时拒绝回答。

公开数据进一步区分 `single-session-user`、`single-session-assistant`、`single-session-preference`、`multi-session`、`temporal-reasoning` 和 `knowledge-update`；`question_id` 以 `_abs` 结尾表示 abstention。

### 一个样本是什么

**一个样本包含按时间排序的多轮 user–assistant sessions**、每个 session 的日期、最终问题及标准答案或开放问题 rubric。系统按时间顺序接收这些历史，并在全部 sessions 结束后回答问题。

历史是预先构造好的；系统可以增量更新自身 memory，但当前被测 Assistant 的回复不会改变后续历史。

### 数据构造

1. 作者人工定义包含 164 种用户属性的 ontology，再由 LLM 围绕属性生成用户背景；
2. LLM 基于背景提出大量候选 question–answer pairs；
3. 人工筛选、重写候选问题，并将最终答案分解为一条或多条 evidence statements；
4. 每条 evidence statement 通过 LLM self-chat 嵌入一个 task-oriented user–assistant session；
5. 人工检查和修改 evidence sessions，并标记 evidence 的具体位置；
6. 从 ShareGPT、UltraChat 和基于其他用户属性模拟的 sessions 中加入无关历史，再分配时间戳，得到长度可配置的完整 haystack。

因此它不是纯人工编写，也不是完全自动生成：LLM 负责生成用户背景、候选 QA 和 evidence sessions；人工负责筛选、重写、整理 evidence 和最终审核。

### 数据规模与评测

三个版本使用同一组 500 个问题：

- **LongMemEval-S**：约 115K tokens、约 40 个 sessions；
- **LongMemEval-M**：约 500 个 sessions、约 1.5M tokens；
- **Oracle**：只保留 evidence sessions。

最终答案允许多种表达，因此论文使用 GPT-4o judge 判断回答是否正确。如果系统输出检索结果，还可使用 evidence 标注计算 Recall@k 和 NDCG@k。Abstention 问题没有真实 evidence 位置，因此不参与 retrieval evaluation。

### Memory System 的三个阶段

论文还将长期 memory system 分为三个阶段，用于分析不同设计：

- **Indexing**：将顺序到来的对话转换成可检索的 key–value memory entries。Value 是最终交给 reader 的历史内容，key 用于检索匹配；
- **Retrieval**：根据当前问题搜索相关 keys 并返回对应 values；论文还研究先解析时间范围再检索的 time-aware retrieval；
- **Reading**：reader 根据取回的 memory 生成答案，比较直接回答与先逐条记录有用信息再综合的 Chain-of-Note。

### 评测方式与侧重点

- **评测时历史 / 轨迹来源：** 给定预先构造、带时间戳的固定 user–assistant sessions，并按时间顺序写入 memory。
- **模型任务：** 所有历史结束后回答问题；如果系统提供 retrieval result，还可单独评估 evidence retrieval。
- **关键监督 / 标注：** 每题提供标准 answer 或开放式 rubric，并标注 answer-bearing sessions 和 turns。Abstention 问题没有 answer-bearing evidence。
- **主要评测目标与粒度：** 可以分别评价最终 QA 与 evidence retrieval，从而区分“没有取回证据”和“取回后没有正确回答”；但不提供每次 indexing、memory writing 或 update 的 gold operation。论文的 indexing–retrieval–reading 是分析框架，而不是逐步监督标注。
- **是否属于 Agent 执行评测：** 否。它是长期交互历史上的 memory QA，不包含工具或环境 action。
- **论文定位（Introduction 中的既有缺口）：** 既有 benchmark 不能充分反映长期 user–AI、task-oriented interaction，历史较短且不可扩展；也缺少 Assistant-side information、跨 session 推理、时间推理、知识更新和拒答。
- **核心研究问题 / 想揭示什么：** 聊天助手是否能在持续增长、动态变化的交互历史中正确保留和使用信息？当最终回答失败时，问题究竟来自 memory 的表示、检索，还是对取回内容的阅读和综合？
- **具体特色（本文如何解决）：** 围绕 500 个问题构造可扩展、带时间戳的 user–assistant history，提供答案与 evidence 监督，并以 indexing–retrieval–reading 三阶段分析不同 memory design。

### 主要结论

商业 memory assistants 和长上下文模型都难以稳定处理持续增长的交互历史。完整历史中加入大量 filler sessions 后，长上下文模型明显弱于只提供 evidence sessions 的 Oracle 设置。

在系统设计分析中，作者发现按 user–assistant round 切分 memory 通常优于整段 session；在 key 中补充 user facts、显式处理时间范围，以及使用结构化输入和 Chain-of-Note，都能改善 retrieval 或最终 QA。


---

## 3.3 MemBench

**论文：** [MemBench: Towards More Comprehensive Evaluation on the Memory of LLM-based Agents](https://arxiv.org/abs/2506.21605)<br>
**官方仓库：** [import-myself/Membench](https://github.com/import-myself/Membench)

**发表时间：** 2025-06-20（首次 arXiv 公开）

### 一句话定位

MemBench 从 **memory level** 和 **interactive scenario** 两个维度扩展 Agent memory 评测：不仅测试显式 factual memory，还测试从多条事实或行为中归纳出的 reflective memory；不仅测试 Agent 直接参与的对话，还测试 Agent 作为第三方观察者接收的信息流。

### 关注什么问题

作者认为既有 memory 评测主要存在四类局限：

1. 主要测试显式事实，较少测试从多个低层事实中归纳出的**高层偏好和特征**；
2. 数据大多是用户与 Agent 直接对话的 participation scenario，**忽略 Agent 只观察第三方消息的 observation scenario；**
3. 评价通常只看最终准确率，缺少效率和容量；
4. 部分数据没有完整用户 profile，或使用长上下文输入方式，不能真实反映 Agent memory 的逐步写入与检索过程。

### 核心贡献

MemBench 用两个轴组织数据：

- **Factual / Reflective**：
  - Factual memory 是对明确出现的用户事实的记忆；
  - Reflective memory 是根据多个行为和事实推断出的高层偏好。
- **Participation / Observation**：
  - Participation 中 Agent 直接参与对话；
  - Observation 中 Agent 接收单向的第三方消息或行为流。

在此基础上，论文同时评测 effectiveness、efficiency 和 capacity，而不仅是最终 QA。

### 任务与一个样本

四个主要组合为：

1. Participation–Factual；
2. Participation–Reflective；
3. Observation–Factual；
4. Observation–Reflective。

Factual 任务包括简单事实、聚合、比较、条件判断、时间标准化和知识更新；Reflective 任务要求从多条具体行为推断电影、书籍或食物等高层偏好。最终问题统一为 multiple-choice QA。

在 Participation 中，Assistant 侧的历史回复是预先给定的，以避免不同被测模型生成不同历史；Observation 中则是单向消息或行为记录。

### 数据构造

1. 构造用户关系图，包含人物、事件、地点、物品和用户 profile；
2. Factual 部分依据关系图属性生成事实和对应对话或消息；
3. Reflective 部分基于 MovieLens、食谱和 Goodreads 等数据建立高层偏好，再将偏好展开成多种具体行为或表达；
4. 使用 LLM 将事实和行为写成自然对话或第三方消息，并加入时间戳；
5. 通过插入与问题无关的信息控制历史长度和噪声。

### 数据规模与评测

数据从 500 个用户关系图出发构造。论文表格分别统计四类数据：

- Participation–Reflective：约 3.5K sessions / questions；
- Participation–Factual：约 51K sessions、39K questions；
- Observation–Reflective：约 2K；
- Observation–Factual：约 8.5K。

不同子集的“样本、session、trajectory”单位不同，不宜将所有 JSON 行数直接视为统一 benchmark 总规模。

评测时，信息按 round 或 message 增量提供，系统不能直接访问完整历史，只能利用自身 memory。指标包括 QA accuracy、retrieval recall、读写延迟和容量。

### 评测方式与侧重点

- **评测时历史 / 轨迹来源：** 给定预先构造的固定对话或第三方消息 / 行为流，并按 round 或 message 增量提供。
- **模型任务：** 回答 factual 或 reflective multiple-choice questions。
- **关键监督 / 标注：** 提供每道题的 gold option / answer；数据构造还保留与问题对应的用户事实、关系或高层偏好，使部分设置可以检查 retrieval 是否覆盖相关信息。
- **主要评测目标与粒度：** 以 factual / reflective QA 为核心，并补充 retrieval recall、读写延迟和容量。它没有 gold memory operation 或完整 state transition，因此主要评价结果和系统效率，而不是 lifecycle 中每一步是否正确。
- **是否属于 Agent 执行评测：** 否。Observation scenario 表示 Agent 作为信息观察者，并不表示它在环境中行动。
- **论文定位（Introduction 中的既有缺口）：** 既有工作主要评测显式给出的 factual memory，忽略由多条行为和事实隐式归纳出的高层 reflective memory，例如 user preference；也主要考虑 Agent 直接参与的对话，忽略第三人称 observation，并且往往只报告准确率。
- **核心研究问题 / 想揭示什么：** Memory system 是否不仅能记住“用户说过什么”，还能从多个低层行为中推断“用户是什么样的人、偏好什么”？当 Agent 只是观察第三方消息而非亲自参与时，记忆能力是否仍然成立？准确率提升是否以更高延迟和容量为代价？
- **具体特色（本文如何解决）：** 以 factual / reflective × participation / observation 形成四类设置，并同时评价 effectiveness、efficiency 和 capacity，使高层记忆、第三方观察和系统成本可以被统一比较。

### 主要结论

简单的完整历史、近期历史或检索 baseline 在不少任务上仍然很强，复杂 memory system 并不总能稳定胜出。Reflective memory 随历史增长更容易退化；不同系统在准确率、写入成本、读取成本和容量之间存在明显权衡。


---

## 3.4 MemoryAgentBench

**论文：** [Evaluating Memory in LLM Agents via Incremental Multi-Turn Interactions](https://arxiv.org/abs/2507.05257)<br>
**官方仓库：** [HF-MAB/MemoryAgentBench](https://github.com/HUST-AI-HYZ/MemoryAgentBench)<br>
**官方数据：** [ai-hyz/MemoryAgentBench](https://huggingface.co/datasets/ai-hyz/MemoryAgentBench)

**发表时间：** 2025-07-07（首次 arXiv 公开）

### 一句话定位

MemoryAgentBench 将多个长文本、对话和学习任务改造成 **incremental multi-turn interaction**，统一评测 memory agent 的 Accurate Retrieval、Test-Time Learning、Long-Range Understanding 和 Selective Forgetting。

### 关注什么问题

作者指出，一般 Agent benchmark 主要评价 reasoning、planning 和 tool execution，较少**单独评价 Agent 如何抽象、保存、更新和检索 memory**。另一方面，长上下文 benchmark 往往把完整文本一次性交给模型，**不能反映 memory agent 在交互中增量接收、压缩和更新信息的方式。**

作者还认为，LoCoMo 的历史相对较短，LongMemEval 的合成对话在主题多样性和真实度上有限；而已有 benchmark 没有在一个统一框架中覆盖上述四项能力。

### 核心贡献与任务

四项能力对应不同类型任务：

1. **Accurate Retrieval**：从超长内容中找回准确事实，包括长文 QA、LongMemEval 子集和新增 EventQA；
2. **Test-Time Learning**：在推理期通过示例学习分类规则或用户偏好，包括意图分类和电影推荐；
3. **Long-Range Understanding**：理解整体长文或复杂情节，包括长文总结和 DetectiveQA；
4. **Selective Forgetting**：在冲突信息出现时保留最新或正确状态，主要通过 FactConsolidation 测试。

需要注意：最新论文将第四项称为 **Selective Forgetting**，但当前官方 Hugging Face 和 GitHub 的 split 名仍为 **Conflict Resolution**。这是论文术语与公开数据目录名称的差异。

### 一个样本与数据构造

作者复用多个已有数据集，并将长文、对话、示例或冲突事实切成按顺序到来的 chunks。Memory agent 每轮只能看到当前 chunk，可以更新 memory；到指定位置后再完成 QA、分类、推荐或总结。

论文还新增：

- **EventQA**：在长程事件流中检索并回答事件信息；
- **FactConsolidation**：基于 MQUAKE 等构造旧事实和新事实冲突，测试系统能否更新并避免继续返回过时信息。

这里的“multi-turn”主要表示固定数据被增量输入，不是 Agent 在外部环境中执行 action。

### 数据规模与评测

Benchmark 共计 2,071 个问题，context depth 约 103K–1.44M tokens。不同子任务沿用原始任务指标，如 QA accuracy、分类准确率、推荐指标或摘要覆盖度。

### 评测方式与侧重点

- **评测时历史 / 轨迹来源：** 给定预先准备并切分好的固定长文、对话、示例或冲突事实 chunks。
- **模型任务：** 随 chunks 增量更新 memory，最后完成 QA、分类、推荐或总结。
- **关键监督 / 标注：** 继承不同来源任务的 gold answer、分类标签、推荐目标或 summary keypoints；各子任务没有统一的 evidence、memory state 或 operation 标注。
- **主要评测目标与粒度：** 通过下游任务表现评价 Accurate Retrieval、Test-Time Learning、Long-Range Understanding 和 Selective Forgetting。它能比较四类能力，但通常不能进一步定位失败发生在写入、检索还是使用阶段。
- **是否属于 Agent 执行评测：** 否。这里的 multi-turn 指固定数据被增量输入，而不是 Agent 与外部环境在线交互。
- **论文定位（Introduction 中的既有缺口）：** 一般 Agent benchmark 重点评价 reasoning、planning 和 tool use，长上下文 benchmark 又常一次性提供完整 context；现有 memory benchmark 没有在增量交互中统一覆盖多种 memory 能力。
- **核心研究问题 / 想揭示什么：** 一个在事实检索上表现好的 memory system，是否也能进行 test-time learning、理解整体长程内容并正确处理冲突信息？是否存在真正通用的 memory architecture，而不是只适合某一类任务？
- **具体特色（本文如何解决）：** 将长文、对话、示例和冲突事实切成 incremental multi-turn chunks，统一评测 Accurate Retrieval、Test-Time Learning、Long-Range Understanding 和 Selective Forgetting。

### 主要结论

没有一种 memory system 同时掌握全部四项能力。长上下文模型在 Long-Range Understanding 上较强；RAG 在事实检索上有优势，但在 Test-Time Learning、整体理解和冲突更新上不稳定。系统表现还对 chunk size、retrieval top-k 和 backbone model 很敏感。


---

## 3.5 MemoryBench

**论文：** [MemoryBench: A Benchmark for Memory and Continual Learning in LLM Systems](https://arxiv.org/abs/2510.17281)<br>
**官方数据：** [THUIR/MemoryBench](https://huggingface.co/datasets/THUIR/MemoryBench)

**发表时间：** 2025-10-20（首次 arXiv 公开）

### 一句话定位

MemoryBench 评测 LLM system 能否在服务过程中从用户的显式或隐式反馈形成 **procedural memory**，并在后续 held-out tasks 上持续改进，而不只是检索预先给定的事实或对话历史。

### 关注什么问题

作者认为已有 memory benchmark 多属于静态长上下文 QA：系统读取预先提供的 semantic corpus 或 episodic history，再从中检索信息。这些设置能够评价 declarative memory，却不能评价系统**是否能从 test-time 用户反馈中学习“以后应该怎样回答或行动”**。

因此，MemoryBench 将 memory 与 continual learning 联系起来：系统不仅要记住发生过什么，还要根据服务日志和反馈更新自身行为。

### 核心贡献

论文提出一个包含三个角色的统一框架：

- **Task Provider** 提供连续任务；
- **LLM System** 完成任务并保存信息或更新参数；
- **User Simulator** 根据 gold label 和系统输出生成反馈；
- **Performance Monitor** 在 held-out tasks 上评价改进和成本。

论文区分：

- Declarative memory：语义语料、用户历史和 profile；
- Procedural memory：从服务期 feedback 中学习到的任务策略。

反馈既包括显式文字或动作纠正，也包括满意度、是否继续交互等隐式行为。

### 一个样本与数据构造

Benchmark 汇集多领域、多语言和多种任务格式的数据。系统先回答 training query，用户模拟器根据 ground truth、任务元数据和系统回答生成一至多轮反馈；这些交互被保存为 service logs。之后系统在 held-out test queries 上回答，以检查是否真正利用了反馈。

论文同时支持在线生成反馈，也公开预生成的 off-policy feedback logs，方便不同系统在相同历史上比较。

### 在线与离线两种交互协议

MemoryBench 的“在线”不是工具环境 rollout，而是**当前 LLM system 先完成服务任务，再由用户模拟器针对该系统本次输出生成反馈**。两种协议需要分开理解：

- **On-policy：** 若任务带有静态知识，先将其载入系统 memory。每个训练 step 随机抽取 100 个 training instances；当前 LLM system 对每个实例作答，并与 User Simulator 进行最多 3 轮对话。模拟器依据当前输出和 gold evaluation metadata 生成 verbal feedback、显式 action feedback，或“like / dislike / copy”等隐式行为。随后这 100 段由当前系统实际产生的服务对话被写入 memory 或用于参数更新，再在完整 held-out test set 上重新评测。如此循环，观察系统是否随着自身反馈日志累积而改进。
- **Off-policy：** 先由指定 backbone 生成训练回答和反馈日志，再把这些已经固定的 service logs 分批提供给待测系统。这样不同系统可以接收相同日志，成本也更低，但日志不一定对应待测系统自己的输出分布。

需要特别注意，**论文主文默认报告的是 off-policy + explicit verbal feedback**；on-policy 结果主要放在 Appendix，并且只运行能够在合理时间内完成的系统。因此，MemoryBench 包含 on-policy 能力，但不能把它整体概括成“所有主实验都由当前系统在线产生轨迹”。此外，它没有网页、代码或工具环境，所谓 action feedback 是用户界面行为信号，而不是 Agent 对外部环境采取的 tool action。

### 数据规模与评测

论文汇集 11 个数据集和多种 LiSo、LiLo、SiLo、SiSo 任务格式，约 20K cases。当前 HF 还提供 balanced 版本以及扩展的 MemoryBench-Full；后者约 17,975 行，但这个数字是当前扩展文件行数，不应替代论文对 benchmark 的统一规模描述。

评测同时考虑：

- Effectiveness：held-out task 改进；
- Efficiency：额外时间、token 和调用成本；
- 稳定性：是否产生遗忘或跨任务干扰。

### 评测方式与侧重点

- **评测时历史 / 轨迹来源：** 两种模式并存：在线模式中，当前模型回答后由用户模拟器生成反馈；离线模式直接给定预生成的固定 service logs。
- **模型任务：** 从显式或隐式反馈中更新 memory / 参数，再完成 held-out tasks。
- **关键监督 / 标注：** 原任务提供 gold labels；用户模拟器基于系统回答与 gold label 生成显式或隐式 feedback；held-out tasks 也有标准答案或任务指标。数据不规定系统应形成哪一种 gold procedural memory。
- **主要评测目标与粒度：** 不以回忆某条历史为最终目标，而评价 feedback 是否使后续任务变好，并同时衡量成本、稳定性、遗忘与跨任务干扰。它评价“学会了没有”，而非逐条检查 memory operation。
- **是否属于 Agent 执行评测：** 不是外部工具环境中的 Agent action benchmark；它更接近服务过程中的 continual learning。
- **论文定位（Introduction 中的既有缺口）：** 既有 memory benchmark 主要从静态 semantic / episodic history 中检索 declarative information，不能评价系统是否能从 test-time 用户反馈中学到“以后应该怎样回答或行动”。
- **核心研究问题 / 想揭示什么：** 用户的显式纠正、满意度和后续行为能否被转化为 procedural memory，并持续改善未来任务？这种学习是否会带来高成本、跨任务干扰或遗忘？
- **具体特色（本文如何解决）：** 构建 Task Provider–LLM System–User Simulator–Performance Monitor 框架，让系统在服务期接收显式或隐式反馈，再在 held-out tasks 上评价持续改进、成本和稳定性。

### 主要结论

当前系统对 procedural feedback 的利用仍然有限。检索型方法在保留显式反馈上通常较稳；参数更新可以带来更深行为变化，但存在成本和干扰。没有一种方法在所有任务和反馈形式上都占优。


---

## 3.6 Mem2ActBench

**论文：** [Mem2ActBench: A Benchmark for Evaluating Long-Term Memory Utilization in Task-Oriented Autonomous Agents](https://arxiv.org/abs/2601.19935)<br>
**官方仓库：** [Cantaloupe-M/Mem2ActBench](https://github.com/Cantaloupe-M/Mem2ActBench)

**发表时间：** 2026-01-13（首次 arXiv 公开）

### 一句话定位

Mem2ActBench 评测 Agent 能否面对一个 **欠指定的当前请求**，**主动判断缺少哪些历史约束，并从长期对话中恢复实体、偏好、状态和参数，生成完整可执行的 tool call。**

### 关注什么问题

作者认为，大量 memory benchmark 使用 Question → Retrieval → Answer 形式。问题本身已经明确告诉系统需要检索什么，例如直接问用户预算是多少，因此主要测试被动 factual retrieval。

真实 task-oriented Agent 中，用户通常不会重复已经建立的上下文，而会说“还是用之前那个”“查一下我们一直关注的指标”。Agent 必须先识别当前请求缺失了哪些参数，再定位历史中的相关事实，并将它们 grounding 到工具调用。

### 核心贡献

论文提出 **inference-driven long-term memory utilization**：

- 当前请求保留明确任务意图；
- 执行所需关键参数被省略或以指代出现；
- 参数分散在长、多 session、经常被无关话题打断的历史中；
- 正确 tool call 能由 memory 唯一支持，但不能仅从最终请求和 tool schema 推断。

作者还利用 Fact Evolution Chain 描述同一实体和属性如何在历史中持续出现或更新，并分析 retrieval 与 parameter grounding 两类失败。

### 数据构造

1. 从 ToolACE 和 BFCL 获取工具 schema 和调用记录，并结合 OASST1 构造多轮对话和噪声；
2. 从历史 turn 中抽取 `(attribute, fact, source ID)`，并绑定到对应实体；
3. 对事实进行主题聚类、去重、冲突和时间演化整理，构建 Fact Evolution Chain；
4. 为目标工具调用确认每个 argument 是否能够从 chain 中显式获得或合理推断；
5. 反向生成省略参数、含指代的当前请求；
6. 使用泄漏检查和 discriminator 过滤仅凭 query + schema 就能回答的样本；
7. 人工验证历史、query 和 gold call 的一致性。

### 一个样本与评测

**一个实例给定固定多 session 历史、一个欠指定请求和工具定义；模型输出一次结构化 tool call**。主实验通常给定正确工具，重点评价 arguments 是否正确，扩展设置再测试 tool selection。环境不会真正执行该调用，也没有后续 observation。

### 评测方式与侧重点

- **评测时历史 / 轨迹来源：** 给定预先构造的固定长期多-session 对话，以及当前欠指定请求和工具定义。
- **模型任务：** 识别缺失参数，从历史中恢复实体、偏好或最新状态，输出一次结构化 tool call。
- **关键监督 / 标注：** 提供 gold tool name 与 arguments；Fact Evolution Chain 描述相关事实的出现、冲突和更新，并记录参数由哪些历史事实 grounding。
- **主要评测目标与粒度：** 评价 tool selection 和 argument correctness，并可分析 retrieval failure 与 parameter-grounding failure。它比纯 QA 更接近 action，但不监督后续环境状态，也没有完整 action trajectory。
- **是否属于 Agent 执行评测：** 部分是。输出是 action，而不是 QA；但工具不会真正执行，也没有后续 observation。
- **论文定位（Introduction 中的既有缺口）：** 既有 Question → Retrieval → Answer 任务通常已经明确告诉模型需要查找什么事实，不能测试欠指定请求中主动识别缺失约束并把 memory 用于 action 的能力。
- **核心研究问题 / 想揭示什么：** Agent 能否先发现当前请求缺少哪些参数，再从长期历史中恢复正确实体、状态和偏好，并准确绑定到 tool arguments？失败究竟来自没有检索到信息，还是找到了却没有正确 grounding 到 action？
- **具体特色（本文如何解决）：** 使用 Fact Evolution Chain 组织实体和属性演化，反向构造省略参数的请求，并提供 gold tool call 与 argument grounding，从而区分 retrieval 和 parameter grounding failure。

### 数据规模与主要结论

Benchmark 包含 400 个 tasks、2,029 个 sessions，每个 session 平均约 13 turns。

实验显示 retrieval 是主要瓶颈：给定 oracle memory 后性能可显著提高。需要推断、时间更新或跨多个 turns 的参数尤其困难。即使系统找到了相关历史，也可能在把事实映射到具体 tool argument 时失败。

### 代表性 Case

当前请求只说：

```text
What's the latest on that tech stock we always track?
```

历史多次围绕 AAPL 展开，gold action 为：

```text
Stock Quote Price(symbol="AAPL")
```

模型需要从历史恢复 `AAPL`，而不是从当前请求直接读取。

---

## 3.7 MemoryArena

**论文：** [MemoryArena: Benchmarking Agent Memory in Interdependent Multi-Session Agentic Tasks](https://arxiv.org/abs/2602.16313)<br>
**官方数据：** [ZexueHe/memoryarena](https://huggingface.co/datasets/ZexueHe/memoryarena)

**发表时间：** 2026-02-18（首次 arXiv 公开）

### 一句话定位

MemoryArena 通过一组 **跨 session、相互因果依赖的 Agent subtasks**，评测过去 action、environment feedback 和中间结果形成的 memory 是否真正帮助 Agent 完成后续任务。

### 关注什么问题

作者认为，**已有 memory benchmark 多在静态历史上做 post-hoc recall，缺少 decision-making、环境变化和 action consequence**；**已有 Agent benchmark 虽然测试动态行动，但通常只包含一个 session，或不同任务彼此独立，不要求 Agent 保留前一个任务的经验。**

因此，两类工作分别测试“记住信息”和“采取行动”，没有形成作者所说的 **Memory–Agent–Environment Loop**：

```text
Action → Environment Feedback → Memory Update → Later Action
```

### 核心贡献与任务

MemoryArena 构建由多个连续 subtasks 组成的 task group，后一个 subtask 的正确完成在因果上依赖前面的结果。四个领域为：

1. **Bundled Shopping**：后续商品必须和之前实际购买的商品属性兼容；
2. **Group Travel**：新成员不断加入，计划要保留既有成员已经确定的安排；
3. **Progressive Search**：复杂问题被拆成有依赖的搜索子问题；
4. **Formal Reasoning**：数学和物理推理被拆成顺序依赖的 lemma 或中间结论。

### 数据构造

- Shopping 基于 WebShop 商品、类别和属性构造正向兼容关系与负向干扰，并由人工验证；
- Travel 基于 TravelPlanner 构造基础旅行者，再依次加入具有新约束的成员；
- Search 从 BrowseComp+ 等问题中拆分必须按顺序解决的 subqueries，并人工验证依赖；
- Formal reasoning 由专家将论文中的核心数学或物理结论分解为顺序推理任务。

### 一个样本与实际评测

一个 task group 包含多个 sessions，每个 session 对应一个 subtask。当前 Agent 在环境中在线执行 action，接收 observation 和 feedback；session 结束后，完整旧轨迹不再直接提供，Agent 只能依靠自身 memory 进入下一 session。

因此，**历史由当前被测 Agent 在线产生**，不同 Agent 可能得到不同 observation、中间结果和后续失败路径。数据提供任务目标、约束、标准结果或环境 verifier，但不存在规定 Agent 必须写下什么的唯一 gold memory。

### 在线执行与跨 Session Memory 流程

一次完整 evaluation episode 对应一个 task group，memory 在开始时清空。随后按因果顺序执行多个 subtasks，论文通常将一个 subtask 视作一个 session：

1. **进入新 session：** Agent 只得到当前 subtask instruction。上一个 session 的完整 action–observation trace 不再作为普通上下文直接可见；长期信息必须由 persistent memory 提供。实验实现通常在 subtask 开始时检索一次与当前任务相关的 memory，以覆盖该 session 内共享的约束。
2. **Session 内在线行动：** Agent 根据当前 instruction、检索到的 memory 和本 session 已产生的局部轨迹选择 action，环境执行后返回 observation。不同领域中的 action 包括网页搜索、筛选和购买，调用旅行规划工具，使用 search / document 工具，以及调用 symbolic reasoning 或 code executor。
3. **Session 结束后写入：** Memory system 接收该 subtask 的 action–observation trajectory，自行决定保存哪些购买结果、兼容属性、旅行安排、中间搜索答案或已证明 lemma。Benchmark 不提供唯一的 gold memory entry。
4. **进入后续 session：** 更新后的 memory 被带到下一 subtask。后续 instruction 往往不会重述先前结果，因此 memory retrieval 会直接影响新的 action；错误购买、错误计划或错误中间结论也会沿依赖链继续造成后果。

这使 MemoryArena 的轨迹具有两层 on-policy 性：**session 内的 observation 由当前 action 决定，跨 session 的可用状态又由当前 Agent 之前真正完成了什么决定。**它评测的不是“读完轨迹后能否回答”，而是 memory 是否在执行过程中改变 action，并最终提高 subtask progress 和整组任务成功率。

### 数据规模与指标

论文报告 766 个 task groups，平均 6.9 个 subtasks 和约 57 个 action steps。不过论文各领域列出的数量为 150 shopping、270 travel、256 search、40 math 和 20 physics，合计 736；当前论文没有解释 30 组差异，综述中应保留这一不一致。

指标包括每个 subtask 的 Task Progress Score，以及整个 task group 是否全部成功的 Group Success Rate。

### 评测方式与侧重点

- **评测时历史 / 轨迹来源：** 当前被测 Agent 在线执行 action、接收 observation 和 feedback，并形成自己的 trajectory。
- **模型任务：** 在多个 session 中连续完成相互依赖的环境 subtasks。
- **关键监督 / 标注：** 数据提供每个 subtask 的目标、约束、期望结果以及环境 verifier；它不规定 Agent 应记录什么，也没有唯一 gold memory 或逐步 memory operation。
- **主要评测目标与粒度：** 使用 Task Progress Score 和 Group Success Rate 直接评价 memory 是否改善后续 action 与整组任务。由于缺少 gold memory，某次失败通常无法精确归因到 writing、retrieval 或 use。
- **是否属于 Agent 执行评测：** 是，而且是 on-policy。不同 Agent 的历史和中间结果可以不同。
- **论文定位（Introduction 中的既有缺口）：** 静态 memory benchmark 多做 post-hoc recall，缺少 decision-making、environment change 和 action consequence；Agent benchmark 又多为单 session 或彼此独立的任务。
- **核心研究问题 / 想揭示什么：** Memory 是否真的能帮助 Agent 完成后续环境任务，而不仅是回答关于过去的问题？错误或不完整的 memory 是否会跨 session 累积，并反过来伤害后续决策？
- **具体特色（本文如何解决）：** 构造跨 session、因果依赖的 task groups，由当前 Agent 在线执行；前面 action、environment feedback 和中间结果会改变后续任务条件，最终以 task progress 和 group success 衡量 memory utility。

### 主要结论

在 LoCoMo 等静态 QA 上表现好的 memory system，放到 MemoryArena 中不一定能完成跨 session action。随着 session 数增加，整组成功率快速下降。Memory 有时能帮助，但错误或不完整的 memory 也会累积并伤害后续任务，formal reasoning 尤其敏感。

### 代表性 Case

Group Travel 中，Jennifer 先确定一套旅行计划；Eric 和 Emma 后续依次加入。新计划必须保留前面已经确定的城市、交通和活动，同时满足新成员约束，而不能每次独立重新规划。

---

## 3.8 AMA-Bench

**论文：** [AMA-Bench: Evaluating Long-Horizon Memory for Agentic Applications](https://arxiv.org/abs/2602.22769)<br>
**官方数据：** [AMA-bench/AMA-bench](https://huggingface.co/datasets/AMA-bench/AMA-bench)

**发表时间：** 2026-02-26（首次 arXiv 公开）

### 一句话定位

AMA-Bench 评测 memory system 能否理解长程 **Agent trajectories** 中的 action、observation、隐藏状态和因果变化，而不仅是自然语言对话中的用户事实。

**从用户对话到真实的场景中的执行轨迹，包含真实agent轨迹和合成轨迹**

### 关注什么问题

作者认为，以聊天为中心的 memory benchmark 与 Agent application trajectory 有三项关键差异：

1. Agent 轨迹包含 ASCII、JSON、HTML、Python、表格等大量机器生成表示；
2. Action 会引起未必直接写出的环境状态变化，需要从前后 observation 推断；
3. Agent trajectory 的客观信息密度较高，而自然对话中包含较多寒暄和重复。

因此，对话 QA 不足以代表网页 Agent、软件工程 Agent、游戏 Agent 和具身 Agent 的长期记忆需求。

### 核心贡献

AMA-Bench 提供两部分：

- **真实 Agent trajectories**：收集多个应用领域的真实轨迹，并由专家构造 QA；
- **Synthetic trajectories**：在 TextWorld、BabyAI 等可控环境中程序化生成任意 horizon、状态和 QA。

任务覆盖四项能力：

1. Recall；
2. Causal Inference；
3. State Updating；
4. State Abstraction。

### 数据构造

真实部分收集 Text-to-SQL、tool QA、网页、软件工程、游戏和 embodied Agent 轨迹。研究生标注者阅读轨迹，为四类能力构造问题和答案，并进行交叉审核。每条真实轨迹固定配 12 个 QA。

合成部分由环境状态和转移规则程序化控制，可改变轨迹长度、action 随机性和 observation 详细程度，并自动获得问题答案和相关 turn 位置。

### 一个样本与评测

**模型读取一条已经完成的固定 Agent trajectory，然后回答多道关于事实、action 因果、状态更新或抽象状态的问题**。它不会重新进入环境执行 action。开放式答案主要通过 LLM judge 评价。

### 评测方式与侧重点

- **评测时历史 / 轨迹来源：** 给定已经采集或程序生成完成的固定 Agent trajectory，包含 action 和 observation；当前模型不重新执行环境。
- **模型任务：** 轨迹结束后回答 recall、causal inference、state updating 和 state abstraction 问题。
- **关键监督 / 标注：** 每题提供 gold answer 和 ability type；合成部分因为环境状态和 transition 可控，还可以自动确定答案及相关 trajectory positions。真实部分主要依赖专家构造的 QA。
- **主要评测目标与粒度：** 评价模型是否理解轨迹中的事实、action consequence 和隐藏状态。它仍然主要是 trajectory-level QA，不评价当前 Agent 的在线 success，也不提供完整 memory lifecycle 标注。
- **是否属于 Agent 执行评测：** 否。内容来自 Agent 执行轨迹，但被测模型不会重新进入环境。
- **论文定位（Introduction 中的既有缺口）：** 以聊天为中心的 benchmark 不能覆盖 Agent trajectory 中的机器生成表示、action 引起的隐式状态变化以及更高的信息密度。
- **核心研究问题 / 想揭示什么：** Memory system 能否理解 Agent 做了什么、为什么导致当前状态，以及多个 action 累积后的抽象状态，而不仅是从轨迹中检索一条显式事实？
- **具体特色（本文如何解决）：** 收集多领域真实 Agent trajectories，并在可控环境中程序生成合成轨迹，围绕 Recall、Causal Inference、State Updating 和 State Abstraction 构造 trajectory QA。

### 数据规模与主要结论

真实部分 208 条 trajectories、2,496 QA；合成部分约 1,200 QA。

长上下文 baseline 往往强于需要先压缩和检索的 memory system，说明 memory construction 和 retrieval 会丢失轨迹细节。不同 memory architecture 的差异通常大于单纯扩大 backbone model；因果推理和隐藏状态追踪比直接 recall 更困难。

### 代表性 Case

一条 Baba Is You 轨迹中，问题询问 step 19 向右移动后，step 20 做了什么以及两步的净效果。Gold answer 是 step 20 向左移动，因此 Agent 回到原位置。它要求结合连续 action 理解状态变化，而不只是复述单步内容。

---

## 3.9 AMemGym

**论文：** [AMemGym: Interactive Memory Benchmarking for Assistants in Long-horizon Conversations](https://arxiv.org/abs/2603.01966)<br>
**官方数据：** [AGI-Eval/AMemGym](https://huggingface.co/datasets/AGI-Eval/AMemGym)

**发表时间：** 2026-03-02（首次 arXiv 公开）

### 一句话定位

AMemGym 构建一个由结构化用户状态约束、但由 LLM 自由生成对话的 on-policy 环境，评测当前 Assistant 自己的回复参与形成历史后，是否仍能正确写入、读取和使用不断演化的用户信息。

### 关注什么问题

作者指出 LoCoMo、LongMemEval 和 MemoryAgentBench 等 benchmark 使用 static、**off-policy history**。**固定历史无法体现 Assistant 自己的回复如何改变用户后续表达**，也可能产生 reuse bias：一个 memory system 在某个 Assistant 生成的历史上表现好，并不代表换成另一个 Assistant 后仍然好。

人工构造大量长程交互成本高；纯用户模拟又面临三个问题：如何**控制用户何时透露信息**、如何**保持对话自然连贯**，以及如何**生成多样但可比较的历史**。

### 核心贡献

AMemGym 将：

- 结构化 persona；
- 离散用户状态；
- 预定义状态演化；
- 状态条件下的评测 QA；

与自由的 LLM role-play 结合。结构化状态保证可控和可诊断，**实际对话则由当前 Assistant 和用户模拟器在线生成**。

论文还提出 Overall Accuracy、Normalized Memory Score，以及 Write、Read、Utilization 三类诊断，并用 proof of concept 展示 Agent 根据环境反馈优化 memory policy。

### 数据与环境构造

1. 从 Nemotron Personas 等来源采样 profile；
2. 选取个性化 evaluation questions，并抽取回答这些问题需要的状态变量；
3. 将变量合并成 global state schema，每个变量有离散取值；
4. 构造多个 evolution periods 中的状态向量和 narrative events；
5. 为不同状态组合生成 reference answers，并使用 verifier 检查答案和状态的一一对应；
6. 每个 session 由固定的 state-bearing user utterance 启动，随后用户 LLM 按 persona、当前状态和已有对话继续 role-play。

### 一个样本与评测

官方数据提供的是 **环境蓝图**，而不是某个固定 Assistant 的完整历史。运行 benchmark 时：

1. 当前 Assistant 与用户模拟器在线对话；
2. 用户状态按预定 period 演化，并在对话中自然披露；
3. 每个 period 后使用所有个性化问题测试当前 memory；
4. 使用隐藏状态对应的 reference answer 评分；
5. 进一步探测系统是否写入了状态、是否能取回、以及取回后是否正确用于回复。

**因此对话历史本身是 on-policy 的，但底层 persona、状态演化和评测答案是预先结构化的**。

### 在线对话如何展开

AMemGym 将“可控状态演化”和“自由对话生成”拆成两层：

1. **离线蓝图层：** 预先确定 persona、每个 period 的完整 user state、哪些变量在何时更新、每个问题依赖哪些 state，以及各 state combination 对应的 reference answer。Assistant 不能通过回复改变这条隐藏状态演化路径。
2. **Session 启动：** 每个 session 先由一条固定的 state-bearing user utterance 开场，确保本次需要暴露的状态确实进入对话；它通常以自然叙述而不是结构化字段表达。
3. **自由 role-play：** 此后的 user turns 由模拟用户根据 persona、当前隐藏状态、最近对话以及目标 Assistant 的真实回复在线生成。因此 Assistant 的语气、追问和建议会改变后续表层对话，两个 Assistant 最终得到的 history 可能不同。
4. **Period checkpoint：** 一个 period 的若干 sessions 完成后，系统重新询问全部 personalized questions，并额外查询相关 state values。最终 QA 和 state probes 被结合起来，区分 Write、Read 与 Utilization failure。
5. **进入下一 period：** 蓝图中的部分状态发生更新，再通过新的 sessions 暴露。系统既要保留仍有效的信息，也要用新状态覆盖旧状态。

因此这里的“action”仅指自然语言 response。回复会影响模拟用户接下来怎样说，但**不会调用工具、改变网页或物理环境，也不会决定隐藏 user state 如何演化**。它可以评价 memory 是否影响后续个性化回复，却不能像 MemoryArena 那样通过真实 action consequence 衡量环境任务成功。

### 数据规模与指标

Base 设置为 20 个 users，每人 10 个 evaluation questions，共 200 questions；状态演化 10 个 periods，并在多个 checkpoint 重复评测。论文还提供更长的扩展设置。

Normalized Memory Score 使用随机回答作为下界、直接提供 ground-truth state 作为上界，以减少不同问题难度的影响。

### 评测方式与侧重点

- **评测时历史 / 轨迹来源：** 当前被测 Assistant 与用户模拟器在线生成自己的长期对话；persona、状态变量和演化路径由环境预先控制。
- **模型任务：** 持续回复用户，并在每个 period 后回答个性化问题。
- **关键监督 / 标注：** 环境提供结构化 persona、每个 period 的隐藏用户 state、state updates，以及不同 state 对应的 reference answers。用户在某个 session 暴露哪些 state 也由环境蓝图控制。
- **主要评测目标与粒度：** 除总体 QA 外，利用 ground-truth state 诊断 Write、Read 和 Utilization：状态是否进入 memory、是否能取回、取回后是否真正用于回答。它比仅有 QA answer 更细，但不是对每次内部 memory operation 给出唯一 gold trace。
- **是否属于 Agent 执行评测：** 属于 on-policy Assistant interaction，但不包含工具或物理环境 action。
- **论文定位（Introduction 中的既有缺口）：** 固定 off-policy history 不能反映当前 Assistant 的回复如何改变用户后续表达，并可能产生 reuse bias；纯用户模拟又难以同时保证状态可控、对话自然和不同系统可比较。
- **核心研究问题 / 想揭示什么：** 在当前 Assistant 自己参与形成的历史上，memory method 的表现和固定历史评测是否一致？失败是没有写入用户状态、无法取回，还是取回后没有真正用于回复？
- **具体特色（本文如何解决）：** 以结构化 persona、离散 user state 和预设 evolution 控制环境，同时让当前 Assistant 与用户模拟器在线 role-play，并通过周期 QA 及 Write、Read、Utilization probes 进行诊断。

### 主要结论

Off-policy evaluation 会改变 memory method 的排名，说明固定历史不能可靠替代当前 Assistant 自己形成的历史。现有系统的 normalized score 仍较低，失败可能分别来自没有写入、找不到状态或找到了却没有用于回答。

### 代表性 Case

Janae 的 bridge gathering 初始状态是参与者 `mostly_50_plus`，之后孙辈和大学生朋友加入，状态变成 `mixed_ages_with_young_adults`。系统后续建议必须同时适合长期朋友和年轻参与者，不能继续使用旧状态。

---

## 3.10 MedMemoryBench

**论文：** [MedMemoryBench: Benchmarking Agent Memory in Personalized Healthcare](https://arxiv.org/abs/2605.11814)<br>
**官方仓库：** [AQ-MedAI/MedMemoryBench](https://github.com/AQ-MedAI/MedMemoryBench)<br>
**官方数据：** [Cyan27/MedMemoryBench](https://huggingface.co/datasets/Cyan27/MedMemoryBench)

**发表时间：** 2026-05-12（首次 arXiv 公开）

### 一句话定位

**MedMemoryBench 面向个性化医疗 Agent**，使用经过医疗专家验证的长期患者轨迹和 **evaluate-while-constructing** 流式协议，评测精确事实记忆、临床状态更新、患者特定推理以及噪声持续积累下的 memory robustness。

### 关注什么问题

作者指出，LoCoMo、LongMemEval、MemoryAgentBench 和 AMA-Bench 等主要面向通用对话或 Agent 轨迹，不能覆盖个性化医疗的四项特殊要求：

1. **Safety-Critical Personalization**：过敏、禁忌症等信息权重远高于普通偏好，需要近乎零错误保留；
2. **Longitudinal Clinical Progression**：疾病指标、用药和症状会跨月变化，不能只简单覆盖旧状态；
3. **Streaming Memory Integration**：真实系统中的 session 持续到来并影响后续交互，而不是先构建完整 memory 再一次性评测；
4. **Noisy Memory Accumulation**：家庭代问、普通健康咨询和重复描述会持续进入 memory，可能造成作者定义的 memory saturation。

### 核心贡献

1. 通过四阶段 human–agent collaborative pipeline 构建长期、临床 grounded 的患者轨迹；
2. 引入 trap events，显式测试过敏、药物禁忌、关键指标和个人限制等高优先级信息；
3. 提出流式 evaluate-while-constructing 协议，每累计一定 sessions 就评测一次；
4. 通过 Efficient / Mixed 两种模式系统研究 memory saturation；
5. 比较多种经典、Agent memory 和 graph memory 方法。

### 数据构造

1. **Patient Profile Construction**：从去标识化真实医疗案例构造 20 个代表性慢性病患者画像；疾病亚型、初始症状和核心临床特征由真实案例 grounding，家庭、职业和生活方式等外围属性由 LLM 扩展。
2. **Disease Progression Event Generation**：生成并由专家验证一整年的诊疗轨迹，覆盖误诊期、转折点、并发症、生活方式挑战和康复；再分解成具有时间与因果关系的 event graph。图中还注入过敏、禁忌症、经济约束等 trap events。
3. **Multi-turn Session Simulation**：Patient Agent 根据当前 event 发起咨询，Physician Agent 评估并回复。每次 session 后记录 topic、时间和 event summary，并反馈给后续对话以保持长期一致性。
4. **Memory Extraction and Query Construction**：Trap Agent 从 session memories 检索患者特定敏感事实，Query Agent 围绕这些事实生成问题，Critique Agent 检查唯一性、memory traceability 和医学专业性；医疗标注者最终验证 trajectory、dialogue 和 QA，并在发现矛盾时回改早期内容。
5. **Noise Augmentation**：Mixed 模式额外加入普通健康知识咨询，以及替父母、配偶或子女进行的 proxy consultation。

### 任务类型

公开数据包含六类 query：

- Entity Exact Match；
- Temporal Localization；
- State Update Tracking；
- Inference & Generation；
- Multiple Choice；
- Multi-hop Clinical Deduction。

前两类强调精确记忆，State Update 测试新旧临床状态，后几类要求结合患者特定事实和医学知识进行推理。

### 数据规模与评测

当前公开版包含：

- 20 个 patient personas；
- 每人约 101 个 medical sessions；
- 2,074 个 events；
- 31,976 个纯医疗 dialogue turns；
- 加噪后 84,068 turns；
- 1,939 个 evaluation queries；
- 120 个 trap events。

这些数字比摘要中的“约 2,000 sessions、16,000 interaction turns”更细，是当前公开数据版本统计。

评测时 sessions 严格按时间顺序写入 memory，每 10 个 sessions 触发一个 checkpoint，只能使用截至当前时间的 memory 回答 queries。Efficient 模式只有患者自身医疗交互；Mixed 模式加入噪声。

### 评测方式与侧重点

- **评测时历史 / 轨迹来源：** 给定预先生成且经专家审核的固定长期医患对话，严格按时间流式写入；当前模型不会改变后续病例轨迹。
- **模型任务：** 在多个 checkpoint 回答精确事实、时间、状态更新和临床推理问题。
- **关键监督 / 标注：** 问题提供 gold answer 与 explanation，并关联 source key points；患者轨迹保留 clinical events、时间关系和 trap events，例如过敏、禁忌症与关键限制。
- **主要评测目标与粒度：** 评价精确事实、状态更新、患者特定推理和多跳临床推断，并通过 Efficient / Mixed 对比分析噪声累积与 memory saturation。标注支持追溯答案依据，但不直接监督系统内部每次 memory write / update。
- **是否属于 Agent 执行评测：** 否。它是医疗对话 memory benchmark，而不是在线临床决策或工具执行。
- **论文定位（Introduction 中的既有缺口）：** 通用对话或 Agent memory benchmark 不能覆盖医疗中的安全关键个性化、纵向疾病进展、流式 memory integration 和持续噪声累积。
- **核心研究问题 / 想揭示什么：** 系统能否长期保留过敏、禁忌症等高风险事实，正确跟踪疾病和用药状态，并在大量无关或代问信息持续进入后仍保持可靠？更多 memory 是否可能造成 memory saturation，反而降低医疗回答质量？
- **具体特色（本文如何解决）：** 构建专家验证的长期患者轨迹与 clinical event graph，注入 trap events，并采用 evaluate-while-constructing 和 Efficient / Mixed 设置，周期性评价事实、更新、临床推理和噪声鲁棒性。

### 主要结论

复杂医疗推理和多跳临床推断是所有方法的明显瓶颈，retrieval 仍是限制最终性能的主要因素。随着 memory 和噪声增加，多数系统性能下降；缺少有效过滤的长期 memory 甚至会伤害结果，这正是论文所说的 memory saturation。


---

## 3.11 LongMemEval-V2

**论文：** [LongMemEval-V2: Evaluating Long-Term Agent Memory Toward Experienced Colleagues](https://arxiv.org/abs/2605.12493)<br>
**官方仓库：** [xiaowu0162/LongMemEval-V2](https://github.com/xiaowu0162/LongMemEval-V2)<br>
**官方数据：** [xiaowu0162/longmemeval-v2](https://huggingface.co/datasets/xiaowu0162/longmemeval-v2)

**发表时间：** 2026-05-12（首次 arXiv 公开）

### 一句话定位

LongMemEval-V2 评测 Agent memory 能否从数百条过去网页任务轨迹中积累 **environment-specific knowledge**，在之后像一个“experienced colleague”一样回答界面状态、工作流、环境陷阱和任务前提问题。

### 关注什么问题

作者认为已有长期 memory 工作主要处理长文档或用户聊天。近期面向 Agent trajectory 的评测又常使用简化游戏，只依赖一条或少量轨迹，或仅通过下游任务成功率间接推断 memory 是否有效。

AMA-Bench 与其最接近，但主要在单条长轨迹中提问；**LongMemEval-V2 关注的是从大量独立历史 trajectories 中逐渐积累一个环境的共同知识。**

### 核心贡献与任务

论文提出 451 个人工问题，覆盖五类环境经验：

1. Static State Recall；
2. Dynamic State Tracking；
3. Workflow Knowledge；
4. Environment Gotchas；
5. Premise Awareness。

Memory system 使用统一的 `Insert` 接口摄入过去 trajectories，再通过一次 `Query` 返回紧凑 context；固定 Reader 根据 context 回答，从而尽量将 context gathering 与 reader 能力分开。

### 数据构造

1. 从 WebArena、WorkArena 和 WorkArena++ 等环境采集网页 Agent trajectories，使用多种 Agent policy 和 rejection sampling 保留成功与失败经验；
2. 人工专家浏览轨迹并构造问题、答案和能力类型，题型包括判断、选择和短答案；
3. 对 environment gotcha 等问题保留必要截图；
4. 标注者先找到 seed answer-bearing trajectories，模型再提出更多候选，最后由人工确认；
5. 程序化构造 Small 和 Medium haystack，并平衡成功与失败轨迹。部分有用环境知识只会出现在失败轨迹中。

### 一个样本与评测

**每道题对应一个包含 100 或约 500 条历史网页 trajectories 的 haystack**。系统顺序 `Insert` 所有轨迹，再 `Query` 一次，返回不超过预算的 context；固定 Reader 输出最终答案。

评测阶段不重新进入网站，memory system 也不会改变历史轨迹。指标主要是 QA accuracy 和 query latency。

### 数据规模

Benchmark 包含 451 个问题。Small 设置每个领域共享约 100 条 trajectories，约 25M tokens；Medium 每题约 500 条，最高约 115M tokens。当前官方 data card 报告约 1,870 条公开 task trajectories。

### 评测方式与侧重点

- **评测时历史 / 轨迹来源：** 给定数百条预先采集好的固定网页 Agent trajectories；当前模型不执行这些历史任务。
- **模型任务：** 先通过 Insert 摄入历史，再用一次 Query 返回紧凑 context，由固定 Reader 回答环境知识问题。
- **关键监督 / 标注：** 当前公开数据主要提供 question、answer 和对应 evaluation function。论文构造阶段使用过人工确认的 answer-bearing trajectories，但公开版本移除了这类 evidence labels 和 provenance。
- **主要评测目标与粒度：** 主要评价 context gathering 后的最终 QA accuracy 与 query latency；固定 Reader 用于减少回答模型差异。由于公开数据没有 gold answer-bearing trajectory，不能像 LongMemEval 那样直接计算 evidence retrieval recall。
- **是否属于 Agent 执行评测：** 否。评测时不会重新操作网站，也不检查 memory 是否帮助当前 Agent 完成新网页任务。
- **论文定位（Introduction 中的既有缺口）：** 既有长期 memory 多关注文档或聊天；trajectory benchmark 常依赖简化游戏、单条或少量轨迹，或只通过下游成功率间接评价 memory；AMA-Bench 主要在单条长轨迹上提问。
- **核心研究问题 / 想揭示什么：** Agent memory 能否从数百条彼此独立的历史任务中逐渐积累可复用的 environment-specific knowledge，像有经验的同事一样理解工作流、界面状态和环境陷阱？瓶颈来自 context gathering 还是 Reader？
- **具体特色（本文如何解决）：** 从 WebArena / WorkArena 系列历史任务中构造环境知识问题，要求 memory 批量 Insert 大量轨迹、Query 紧凑 context，再由固定 Reader 回答，从而尽量分离 memory 和 reader。

### 主要结论

多数通用 memory 方法难以在数十到上百 M tokens 的轨迹中稳定提取环境经验。作者提出的 AgentRunbook-C 准确率较高，但 query latency 和成本也较大。即使给出正确轨迹，Reader 仍可能无法从复杂网页状态中读出答案，说明检索和阅读都是瓶颈。

### 代表性 Case

一题询问为 developer laptop 订购 Dell XPS 时，选择最大 SSD 需要额外多少钱，Gold answer 为 `300`。答案来自过去网页轨迹中的环境配置，而不是通用知识。

---

## 3.12 EvoMemBench

**论文：** [EvoMemBench: Benchmarking Agent Memory from a Self-Evolving Perspective](https://arxiv.org/abs/2605.18421)<br>
**官方仓库：** [DSAIL-Memory/EvoMemBench](https://github.com/DSAIL-Memory/EvoMemBench)

**发表时间：** 2026-05-18（首次 arXiv 公开）

### 一句话定位

EvoMemBench 从 **memory scope（in-episode / cross-episode）** 和 **memory content（knowledge / execution）** 两个轴统一组织六个任务，比较不同 memory system 在当前 episode 内维持信息，以及跨 episode 积累可复用知识或执行经验的能力。

### 关注什么问题

作者认为，LoCoMo、LongMemEval、MemoryAgentBench 等文本型 benchmark 主要测试知识的保留、检索和修订，较少覆盖 action 和 tool execution；MemoryArena、MemoryBench 及 lifelong-agent 工作虽然涉及任务或持续学习，却没有同时覆盖：

- 一个 episode 内与多个 episodes 间；
- Knowledge-oriented 与 execution-oriented memory。

一些相关 benchmark 也未完全开放，难以在同一协议下复现实验。因此**领域缺少能够解释“哪种 memory 在什么任务上有效”的统一比较。**

### 核心贡献

论文提出二维 taxonomy：

| | Knowledge-oriented | Execution-oriented |
|---|---|---|
| **In-episode** | 当前 episode 中保留事实、约束和长上下文 evidence | 维持任务进度、工具结果和未完成子目标 |
| **Cross-episode** | 从共享背景的先前 episodes 积累可复用知识 | 从先前任务提炼 procedure、action routine 和环境经验 |

最终形成六个 benchmark：

- InEp-Know；
- InEp-Exec；
- CrossEp-Know；
- CrossEp-Tool；
- CrossEp-Web；
- CrossEp-Emb。

论文在标准化协议下比较 15 类 memory methods 和强 long-context baselines。

### 数据构造与来源

EvoMemBench 是一个异构 suite，而不是从零生成的单一数据集。

- **InEp-Know**：复用 MemoryAgentBench 的 Accurate Retrieval 和 Selective Forgetting / Conflict Resolution 子集；
- **InEp-Exec**：从 BFCL-MultiTurn-LongContext 改造，将重复出现的实体、参数和工具结果改成必须从先前 turns 恢复的隐式指代，并人工验证；
- **CrossEp-Know**：从 CL-Bench 选择至少共享五个样本的 context，将同一背景下的 episodes 按顺序提供；
- **CrossEp-Tool**：基于 BFCL MultiTurn Base，将前序工具环境中的经验保留到后续 episode；
- **CrossEp-Web**：使用 XBench DeepSearch 和 WebWalkerQA，让 memory 在一组搜索任务中积累并迁移；
- **CrossEp-Emb**：使用 ALFWorld 六类具身任务，测试先前 episode 的 action experience。

### 一个样本与评测

In-episode 任务在一个 episode 内初始化、更新并清空 memory；cross-episode 任务先在早期 episodes 更新 memory，再在共享 context 或 source→target 迁移任务中复用。

Knowledge tasks 主要看 answer accuracy；execution tasks 看 success rate、progress 和 steps；所有设置还统计 Agent 与 memory module 的 token usage。

### 哪些子任务会在线生成轨迹

EvoMemBench 不是统一的 on-policy benchmark，六个任务的交互方式不同：

- **InEp-Know：固定增量输入。** 预先准备的信息块按顺序到达；memory 在 episode 开始时初始化，在每个 progressive information block 后更新，episode 结束后清空。这里没有外部环境 action。
- **InEp-Exec：单 episode 在线 tool interaction。** Agent 在 BFCL 风格工具环境中连续输出 tool calls，工具返回结果；memory 在每个 interaction turn 后在线更新，用于恢复前面出现的实体、参数和工具结果。episode 结束后 memory 清空。
- **CrossEp-Know：固定任务流。** 同一 shared context 下的 episodes 顺序处理；每个 episode 后更新 memory，并在后续同背景任务中使用，但主要输出仍是答案而非环境 action。
- **CrossEp-Tool / Web / Emb：跨 episode 在线执行。** 当前 Agent 分别完成工具调用、网页搜索或 ALFWorld 具身任务；每个 episode 产生自己的 action–feedback trajectory，episode 结束后将经验写入 persistent memory，并在同一 subset 的后续任务中复用。论文还设置 source→target transfer：先在 source subset 建 memory，再将其冻结后用于 target subset。

这里与 MemoryArena 的区别是：EvoMemBench 的 cross-episode execution 主要测试**过去任务中提炼的 procedure、API constraint、search strategy 或 action routine 能否迁移到新的任务**；后一个 episode 通常不是由前一个 episode 的具体环境结果因果决定。MemoryArena 则显式构造一组相互依赖的 subtasks，后续任务必须使用前面真正产生的结果。

### 数据规模

官方仓库当前列出：

- InEp-Know：2,800；
- InEp-Exec：800；
- CrossEp-Know：884；
- CrossEp-Tool：800；
- CrossEp-Web：270；
- CrossEp-Emb：200。

合计 5,754 个 evaluation samples，但六类 sample 的含义不同。

### 评测方式与侧重点

- **评测时历史 / 轨迹来源：** 依子任务而异：部分给定固定文本或 chunks，部分由当前 Agent 在线完成 tool、web 或 embodied episodes。
- **模型任务：** 依子任务完成 QA、tool call、搜索或 embodied action。
- **关键监督 / 标注：** 六个任务继承各自来源 benchmark 的 gold answers、class labels、gold tool calls、possible answers 或环境 verifiers；没有一套统一的 memory state、evidence 或 operation annotation。
- **主要评测目标与粒度：** Knowledge tasks 看答案；execution tasks 看 success、progress 和 steps；同时统计 Agent 与 memory module 成本。它的目标是比较不同 memory family 在 scope × content 四象限中的适用性，而不是诊断统一 lifecycle。
- **是否属于 Agent 执行评测：** 部分是。不同子任务包含固定输入与在线环境，不能用单一协议概括。
- **论文定位（Introduction 中的既有缺口）：** 文本 memory benchmark 偏向 knowledge retention，Agent / lifelong 工作又没有同时覆盖 in-episode / cross-episode 与 knowledge / execution，缺少统一、可复现的比较。
- **核心研究问题 / 想揭示什么：** 不同 memory form 究竟适合什么任务？在当前 episode 保存事实，与跨 episode 积累知识或执行经验，是否需要不同机制？是否存在对所有 scope 和 content 都有效的通用 memory？
- **具体特色（本文如何解决）：** 提出 scope × content 二维 taxonomy，组织六个知识、工具、搜索和具身任务，并在统一协议下比较多类 memory methods 的适用范围。

### 主要结论

长上下文 baseline 仍然非常有竞争力，专门 memory system 尚不是通用解法。Memory 在当前 context 不足或任务更难时帮助最大；retrieval memory 更适合知识密集任务，procedural / long-term memory 在执行任务与已存经验结构匹配时更有效。没有一种 memory form 在全部设置中稳定最好。


---

## 3.13 MemGym

**论文：** [MemGym: a Long-Horizon Memory Environment for LLM Agents](https://arxiv.org/abs/2605.20833)<br>
**官方数据组织：** [MemGym](https://huggingface.co/MemGym)

**发表时间：** 2026-05-20（首次 arXiv 公开）

### 一句话定位

MemGym 将工具对话、代码修复、网页操作和多跳研究任务纳入统一 memory–reasoning interface，并通过同一 reasoner 下的 **memory / no-memory paired comparison**，尽量隔离 memory strategy 对长程 Agent 结果的真实贡献。

### 关注什么问题

作者认为，现有 memory benchmark 主要关注多轮聊天中的个性化事实，不能代表 Agent 在代码、搜索和网页执行过程中动态形成 memory。真实 Agent benchmark 又有三项评测困难：

1. 最终 task success 同时受 reasoning、tool use 和 memory 影响，无法隔离 memory；
2. 某些所谓 memory facts 可以从环境、代码仓库或模型参数中重新发现，形成 illusory memory pressure；
3. 完整 Docker / browser rollout 成本太高，难以大规模训练和比较 memory policy。

### 核心贡献与任务

MemGym 包含五条轨道：

1. τ²-bench 工具对话；
2. SWE-Gym 代码修复；
3. WebArena-Infinity 网页操作；
4. MemGym-CodeQA；
5. MemGym-DR。

前三项封装现有真实 Agent 环境；后两项通过可控生成和 memory ablation，构造明确需要 memory 的代码与研究 QA。论文还训练 MemRM，以较低成本近似昂贵的环境 rollout reward。

### 数据构造

**MemGym-CodeQA：**

- 从 SWE-smith bug、hidden patch 和 tests 出发；
- 多轮抽取完成修复所需的 repository facts；
- 区分可重新从仓库发现的 facts 与 memory-only facts；
- 只保留至少依赖多个关键 memory-only facts 的样本；
- 加入相似但无关的代码事实作为 distractor，并通过可解性、泄漏和混淆检查。

**MemGym-DR：**

- 构造多个顺序依赖的 research subquestions 和 bridge-fact chain；
- 将每个中间事实放入不同 turns 或 memory files；
- 加入相似、冲突、时间变换和 filler 信息；
- 使用 memory / no-memory ablation 过滤不真正依赖 memory 的题；
- 对部分内容进行 fictionalization，降低模型仅靠预训练知识回答的可能性。

### 一个样本与评测

不同轨道协议不同：

- 真实 Agent 轨道在工具、代码或网页环境中执行；
- 部分轨道使用 replay-and-fork，使相同 reasoner 分别在有 memory 和无 memory 条件下从同一起点继续；
- CodeQA / DR 则在固定 memory 历史上回答问题。

核心指标是在固定 reasoner 下比较 memory 条件与 no-memory 条件的结果差异，而不只报告单个系统的最终 success。

### 在线 Rollout、配对比较与 Replay-and-Fork

MemGym 用统一的 per-step contract 包装各环境：

```text
env.reset → memory_manager.manage_context → agent.act → env.step
```

Memory manager 先对当前 prompt / history 执行保留、总结、结构化压缩或 retrieval，并记录本次 condensation event；固定的 reasoning model 再选择 action，环境返回 observation 与 reward。Trajectory recorder 保存完整 turns、压缩前后 context、action、observation 和 reward，因此在线轨迹能够用于后续分析与训练。

- **在线环境轨道：** τ²-bench 中 Assistant 与 user simulator 交互并调用工具；SWE-Gym 在代码仓库和执行环境中编辑、测试；WebArena-Infinity 在网页环境中操作；MemGym-DR 进行多轮检索与研究。它们的后续 observation 会随当前 Agent action 改变。
- **固定或轻量轨道：** MemGym-CodeQA 主要在预构造的 memory history 上回答代码问题，不等同于完整 repository rollout。不同轨道不能统一称为纯在线执行。
- **Paired memory gain：** 对同一任务固定 reasoning model，分别运行 with-memory 与 no-memory 条件，以结果差值衡量 memory gain。这样控制了模型选择，但 memory 会改变后续 action distribution，因此作者也明确指出它不是把 memory 当作完全独立能力的纯净因果消融。
- **Replay-and-fork：** 对昂贵的代码和网页轨道，系统先记录可执行 trajectory，再重放已有 tool actions 以恢复 fork point 的 repository / environment state，只在压缩触发点之后重新查询 policy。这样可以比较某次 compression 的后果或构造 SAFE / HARMFUL 标签，而不需要每次从头完成整段 Docker 或 browser rollout。

所以 MemGym 同时包含三类数据来源：当前 Agent 的真实在线 rollout、从已记录 trajectory 重建的 counterfactual replay，以及预构造的 memory-grounded QA。它关注的是 memory 在固定 reasoner 下的边际影响，而不是单一形态的跨 session memory benchmark。

### 数据规模

- CodeQA：670 个 verified instances、2,131 QA；
- DR：1,194 个 verified instances，其中 161 个 3-hop、916 个 4-hop、117 个 5/6-hop；
- 其他三条轨道继承原环境规模。

### 评测方式与侧重点

- **评测时历史 / 轨迹来源：** 依轨道而异：在线轨道由当前 Agent 执行；另有 replay-and-fork 固定轨迹和预构造合成 memory histories。
- **模型任务：** 完成工具对话、代码修复、网页操作或多跳 QA。
- **关键监督 / 标注：** 真实 Agent 轨道使用环境 verifier、tests、hidden patch 或任务成功信号；CodeQA / DR 等合成轨道进一步标注 memory-only facts、bridge-fact chains、distractors，并通过 memory / no-memory verification 确认任务确实依赖 memory。
- **主要评测目标与粒度：** 核心不是单独报告最终 success，而是在同一 reasoner 下比较 memory 与 no-memory 条件，估计 memory 的边际贡献，并排除可以从环境重新发现信息的虚假 memory pressure。它通常不逐步监督具体 memory operation。
- **是否属于 Agent 执行评测：** 部分轨道是在线 Agent，部分是回放或固定 QA。
- **论文定位（Introduction 中的既有缺口）：** 真实 Agent task success 同时混合 reasoning、tool use 和 memory；很多任务中的信息还可以重新从环境发现，未必真正需要长期 memory，而完整 rollout 又成本很高。
- **核心研究问题 / 想揭示什么：** 观察到的性能提升究竟来自 memory，还是更强 reasoning、工具能力或重新发现信息？一个任务是否真的存在 memory pressure，memory 带来的边际贡献有多大？
- **具体特色（本文如何解决）：** 统一工具、代码、网页和研究任务，使用 memory / no-memory paired comparison、replay-and-fork 和 ablation 验证 memory pressure，并训练 MemRM 近似昂贵的 rollout reward。

### 主要结论

Memory 的收益高度依赖任务：在文件系统已保存大量状态的 coding 环境中增益较小，在工具对话和网页任务中更明显。在经过 ablation 验证的 CodeQA 和 DR 中，无 memory baseline 会显著下降，说明这些任务确实提供了 memory pressure。A-Mem 等方法表现较强，但没有统一最优策略。


---

## 3.14 WorldMemArena

**论文：** [WorldMemArena: Evaluating Multimodal Agent Memory Through Action–World Interaction](https://arxiv.org/abs/2605.29341)<br>
**官方数据：** [LCZZZZ/WorldMemArena](https://huggingface.co/datasets/LCZZZZ/WorldMemArena)

**发表时间：** 2026-05-28（首次 arXiv 公开）

### 一句话定位

WorldMemArena 在固定的多模态长期轨迹上，将 Agent memory 明确拆成 **writing、maintenance、retrieval 和 use** 四个阶段，并**为 memory points、状态更新、视觉证据和 QA 提供细粒度标注**，以定位完整生命周期中的失败。

### 关注什么问题

作者指出已有 benchmark 有四项不足：

1. 多关注长对话中“记住了什么”，而不是经验如何支持后续行动或任务理解；
2. 通常只报告最终 QA，无法区分 writing、maintenance、retrieval 和 use 哪一步失败；
3. 主要是文本，或把图片压缩成 caption，不能测试视觉细节与跨模态 evidence；
4. 随着 Agent harness 开始自主编写、合并和重组 memory，缺少统一比较手工 pipeline 与 self-managing memory agent 的平台。

### 核心贡献

论文将多模态 Agent memory 表述为 Action–World Interaction Loop，并建立两个场景：

- **Lifelong Evolution**：人物、项目或世界状态跨 session 持续变化；
- **Agentic Execution**：GUI、ALFWorld、Minecraft 等 Agent action–observation 轨迹。

每个 session 提供 gold memory points、更新关系和 distractors；每个 checkpoint 提供 QA 和对应 memory / image evidence，使四个阶段能够分别评测。

### 数据构造

1. 将原始长期数据或 Agent trajectory 按 subgoal、feedback 和状态变化切分为 sessions；
2. 从每个 session 提取应写入的 gold memory points，包括事实、状态更新和未来任务需要的信息；
3. 跨 sessions 合并、去重和修订 memory，保证时间一致性，并标记新 memory 替代的旧 memory；
4. 构造 11 类问题，覆盖事实、更新、时间、视觉检索、跨模态推理和 test-time learning；
5. 多名人工标注者审核 memory、QA 和 evidence。

### 一个样本与评测

系统顺序读取固定 sessions，并在 checkpoint：

1. 生成或维护 memory；
2. 根据问题检索 memory 或图片；
3. 输出最终答案。

可以分别计算 memory writing、update、retrieval 和 answer use 的表现。尽管数据包含 Agent action trajectory，评测时不会重新执行环境，系统写下的 memory 也不会改变后续固定轨迹。

### 数据规模

当前 v2 公开：

- 461 个 samples；
- 8,489 个 sessions；
- 59,239 个 turns；
- 15,595 张 images；
- 40,194 个 memory points；
- 24,258 个 QA；
- 平均 18.4 sessions。

较早的摘要或搜索结果有时写 400 tasks，应以当前 v2 数据和论文版本的 461 为准。

### 评测方式与侧重点

- **评测时历史 / 轨迹来源：** 给定预先收集并切分好的固定多模态对话、GUI 和 embodied action–observation trajectories；当前模型不重新执行环境。
- **模型任务：** 顺序处理 sessions，写入和维护 memory；在 checkpoint 检索 memory / image evidence，并回答问题。
- **关键监督 / 标注：** 每个 session 提供：
  - **Gold memory points**：这一 session 中应该写入哪些信息；
  - **State updates**：哪些旧 memory 应被新状态修订或替换；
  - **Distractors**：哪些内容不应写入，或不应在后续回答中使用；
  - 每个问题还提供 **Evidence points** 和标准答案，指明回答需要哪些 memory 或 image evidence。
- **主要评测目标与粒度：** 这些标注将最终 QA 拆成完整 lifecycle：
  1. **Writing**：该记的信息是否被写入，distractor 是否被错误写入；
  2. **Maintenance**：状态变化后旧 memory 是否被正确更新；
  3. **Retrieval**：当前问题所需 evidence 是否被取回；
  4. **Use**：取回正确 evidence 后是否生成正确答案。
  因此 WorldMemArena 不只是“有细粒度标注”，而是能够系统区分四个阶段的 failure。
- **是否属于 Agent 执行评测：** 否。虽然输入包含 Agent action、GUI 与具身世界，评测时不会重新执行环境，memory 也不会改变后续固定轨迹。
- **论文定位（Introduction 中的既有缺口）：** 既有工作多只看最终 QA，不能区分 writing、maintenance、retrieval 和 use；主要是文本或 image caption，缺少原生多模态 evidence，也缺少对 self-managing memory 的完整诊断。
- **核心研究问题 / 想揭示什么：** 最终回答错误时，究竟是该写的内容没有写入、旧状态没有更新、检索错了，还是 evidence 已取回却没有正确使用？反过来，最终回答正确是否也可能掩盖中间 memory 状态或过程上的错误？
- **具体特色（本文如何解决）：** 构建 Lifelong Evolution 与 Agentic Execution 多模态轨迹；每个 session 标注 Gold memory points、State updates 和 Distractors，每个问题标注 Evidence points 与 answer，因此可分别评价 writing、maintenance、retrieval 和 use。

### 主要结论

写入更多 memory 或取得更高 retrieval recall，不一定带来更高最终回答表现；维护错误、视觉 evidence 未使用和 reader 混淆都会造成断点。Agentic Execution 通常比 Lifelong Evolution 更难，尤其是在图片和 GUI 细节上。Harness-based memory 更灵活，但成本高且行为不稳定。

### 代表性 Case

在 LibreOffice Calc 轨迹中：

- 空白表格加载后选中的是 `A1`；
- 设置表头颜色时点击 `Background` tab；
- 对轨迹从未记录的预选颜色，标准答案明确要求回答该信息未被捕获。

这个案例同时测试视觉证据、action memory 和 memory boundary。

---

## 3.15 MemOps

**论文：** [MemOps: Benchmarking Lifecycle Memory Operations in Long-Horizon Conversations](https://arxiv.org/abs/2607.12893)<br>
**官方仓库：** [MemTensor/MemOps](https://github.com/MemTensor/MemOps)

**发表时间：** 2026-07-14（首次 arXiv 公开）

### 一句话定位

MemOps 不只检查最终 QA，而是将 **Remember、Update、Forget 和 Reflect** 作为显式的数据构造与监督单位，直接评价 memory trigger、target binding、状态变化和 evidence provenance 是否正确。

### 关注什么问题

作者指出，最终 QA 将 memory 当作黑箱，会混淆多种错误：

- 系统没有识别需要记忆的 trigger；
- 将信息绑定到错误人物或对象；
- 更新后仍返回 stale value；
- Forget 时误删相关但不应删除的事实；
- Reflect 生成没有 evidence 支持的概括。

更严重的是，系统可能在内部 memory state 不安全或不一致时偶然回答正确，因此最终答案不足以判断 memory operation 是否可靠。

虽然已有工作涉及 knowledge update 或 selective forgetting，但没有**把 operation 作为显式构造和监督单位，同时提供 state transition 和细粒度诊断。**

### 核心贡献与任务

MemOps 定义四类基本操作：

- **Remember**：写入新事实并绑定正确对象；
- **Update**：用新值替代旧值；
- **Forget**：只删除指定目标；
- **Reflect**：基于有界 evidence 形成更高层结论。

多个 operations 还能组合成 TrajectoryOps。论文设计六类 probes：

1. OperationTrace；
2. TargetBinding；
3. StateTransition；
4. CandidateDisambiguation；
5. OperationApplication；
6. StateTrajectory。

### 数据构造

1. 生成多样的合成背景、人物和主题；
2. 构造包含 operation trigger 的 evidence conversations；
3. 同时生成 gold operation、问题、标准答案和 verifier rubric；
4. 生成 target-aware 但 state-neutral 的 distractor conversations；
5. 将 evidence 和 distractors 注入 UltraChat sessions，形成 adjacent 和 longitudinal 两种上下文；
6. 使用自动 verifier 和人工检查保证 operation、evidence 和答案一致。

### 一个样本与评测

系统读取包含 evidence 和 distractors 的固定长对话，然后根据 probe 输出 operation、target、更新后的 state、证据路径或最终答案。论文既看最终 answer accuracy，也看 operation F1、provenance、stale-state leakage、forget leakage 和 reflect precision。

### 数据规模

官方数据包括：

- 403 段 evidence conversations；
- 1,209 个 segments；
- 9,672 个 turns；
- 2,006 个 QA；
- Adjacent 与 longitudinal 两种上下文共 4,012 evaluation instances；
- 100 个主题。

### 评测方式与侧重点

- **评测时历史 / 轨迹来源：** 给定预先构造的固定合成长对话，其中包含显式或隐式 operation trigger 及 distractors。
- **模型任务：** 根据不同 probe 输出 operation、target、state transition、provenance 或最终答案。
- **关键监督 / 标注：** 为每次 operation 提供类型、trigger span、target、old value、new value 和 evidence spans；同时提供 gold memory state、gold provenance、expected answer 和 judge rubric。
- **主要评测目标与粒度：** 可以直接评价 OperationTrace、TargetBinding、StateTransition、CandidateDisambiguation、OperationApplication 和 StateTrajectory，并测 stale-state leakage、forget leakage 与 reflect precision。它关注的是具体 Remember / Update / Forget / Reflect 是否正确，而不只是 lifecycle 的阶段性结果。
- **是否属于 Agent 执行评测：** 否。它不包含工具或环境 action。
- **论文定位（Introduction 中的既有缺口）：** 只看最终 QA 会混淆 trigger、target binding、update、forget 和 reflect 等错误；系统甚至可能偶然给出正确答案，但内部 memory state 已经错误或不安全。已有更新 / 遗忘任务也缺少显式 operation supervision。
- **核心研究问题 / 想揭示什么：** 最终答案正确是否真的意味着 memory 正确？系统是否在正确时机执行了正确 operation、绑定了正确对象，并得到正确 state？Operation-level 监督能否揭示被最终 QA 掩盖的 stale state、误删和无证据 reflection？
- **具体特色（本文如何解决）：** 将 Remember、Update、Forget、Reflect 作为显式构造与监督单位，提供 operation、trigger、target、old/new value、state transition 和 provenance，并设计多类 probes 分别评价内部 memory 行为与最终答案。

### 主要结论

Session-level retrieval 通常优于过细的 turn-level retrieval，因为 operation 需要理解局部上下文。长程 state trajectory 和多次更新仍然困难。最终 QA 与正确 operation state 并不完全一致，验证了作者“只看答案会掩盖 memory failure”的核心观点。


---
