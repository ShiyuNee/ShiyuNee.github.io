---
permalink: /blogs/RSI-Where-the-Loop-Closes/
title: "递归如何闭环？——从可修改范围到 Agent as Service"
date: 2026-08-10
layout: single
author_profile: true
---

> **《走向递归自我改进：从 Self-Evolving Agents 到 RSI》系列·下篇**<br>
> 本篇回答 **Where does the loop close?**：什么样的改进才构成递归，以及如何科学地验证这种递归。<br>
> 上篇：[什么在进化？——Model、Harness 与 Artifact 的三层地图]({{ '/blogs/RSI-What-Evolves/' | relative_url }})

## 写在前面：来源与致谢

这篇文章主要基于 **Melon** 的小红书长文[《万字深度：从 Self-Evolve 到 RSI》](https://www.xiaohongshu.com/discovery/item/6a71f07700000000220146bf)整理而成。原文从“AI 被允许修改什么”出发，系统梳理了 Self-Evolve 不断向外扩张的改进范围，并进一步提出 Everything as Service、Agent as Service，以及 Scoped → Joint → Recursive 的研究路线。这些是本文最重要的思想来源。

原作者把大量分散的研究工作组织成了一条非常有启发性的主线。我的工作主要是依照这条主线重新编排学习笔记，补充相关论文与项目的链接、时间和机制说明，并把“可修改范围”与“递归依赖”“实验归因”之间的关系展开。文中的核心框架和研究判断应归功于原作者；本文不替代原文，也不把这些贡献视为自己的原创观点。推荐读者先后对照阅读原文与本文。

{::options toc_levels="1-4" /}

**目录**

* TOC
{:toc}

---

# 定义

只要系统循环了几轮，只要模型用到了自己的输出，只要 agent 修改过自己的 prompt、skill 或代码，就已经接近 RSI？No！递归描述的是一种依赖关系，而不是迭代次数。

判断一个系统离 RSI 有多远，真正应该问的是：

- AI 被允许改什么？

- 被改进的东西，有没有重新成为下一轮更好的改进者？

从这个角度看，目前的 self-evolve 工作不是一条简单的时间线，而是在**不断扩大可改进对象的 scope**：从内到外，第一层是模型输出，然后是模型参数，外面又包着harness，在外面是环境，然后是整个训练流程，最后是改进更外层的优化者本身。

- 最内层改答案和 reasoning。

- 再往外改数据、reward 和 weights。

- 然后改 prompt、skill、tool、memory 和 harness。

- 再改环境、任务分布和 curriculum。

- 接着改训练流程和研究流程。

- 最后，才是改进负责这些工作的 trainer 和 researcher。

作者的核心思想，RSI不是给一个超级agent无限自由的修改空间，而是应该区分好RSI中的各个组件，每个组件都当作Service (Everything as Service)。这不是普通的工程优化，而是 RSI 的实验架构。这样才能研究好每个模块，进行优势/错误归因（可验证），进行组合和递归。不然修改空间太大一方面很难改好，另一方面归因也很困难。真正可验证、可组合、可递归的 RSI，**需要把不同改进对象拆成彼此隔离的 service**。

- Model as Service。
- Data as Service。
- Train as Service。
- Serve as Service。
- Eval as Service。
- Environment as Service。
- Harness as Service。
- 最终是 Agent as Service。

它解决的不是“API 好不好用”，而是三个更基础的问题：

- 一次进步来自哪里？
- 不同类型的改进如何组合？
- 改进后的系统怎样重新进入下一轮？

# 分类

进一步分析可以发现，六个阶段其实在回答不同的问题：

- **01** 首先回答：模型能不能利用自己产生的经验继续改善行为？
- **02–04** 进一步回答：这些经验最终通过什么方式产生持久改进——进入 weights、harness，还是改变未来的 learning environment？
- **05** 不再预先规定修改对象，而是把“下一步应该改什么”的判断权交给 researcher。
- **06** 最后把负责完成这些 improvement 的 researcher / trainer 本身也变成优化对象。

这个 scope 的扩张也是整篇博客理解 Self-Evolve → RSI 的主线：不是简单按年代排列，而是**可修改对象越来越外层，最终把“负责改进的系统”本身也变成改进对象**。

| 阶段                                   | 核心关注的问题                                               | 我们归纳的典型套路                                           | 离严格 RSI 还差什么？                                        | 主要发生变化的对象                                           |
| -------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------ |
| **01 Output / Reasoning / Trajectory** | **How do I use my own experience?** 模型能否利用自己产生的 answer、reasoning、trajectory 和 failure 改善之后的行为？ | **执行 → 得到中间产物/失败 → reflection / critique / filtering → 把这些经验重新用于下一次行为**。核心是 **self-generated experience reuse**。 | **“该怎么利用经验”仍然是人设计好的。** Reflection 怎么做、feedback 从哪里来、什么算成功、经验如何保存、何时停止，通常都是固定的。模型是在一个固定 improvement mechanism 内不断改行为，还没有修改这个 mechanism 本身。 | 不唯一：可能只是 context / trajectory，也可能进一步进入 memory、skill，甚至最终进入 weights。 |
| **02 Data / Reward / Weights**         | **How do I train myself from my own signals?** 模型如何自己制造 training signal，并把经验真正 internalize 到参数中？ | **自己生成 data / response / problem / reward / self-edit → filtering / verification → SFT / RL / DPO → 新 checkpoint → 新模型继续产生下一轮信号**。核心是 **self-generated supervision → model update**。 | **“训练自己”仍不等于“决定自己应该怎么被训练”。** 模型可以自产 data/reward，但通常是人提前规定优化 weights、采用什么 training algorithm、loss/reward 如何定义、evaluation 怎么做。 | **Model weights / checkpoint**。经验被 internalize 到参数。  |
| **03 Harness**                         | **How do I externalize my experience into a better system?** 能否不改 weights，而把经验沉淀到模型外部的 agent system？ | **执行 → 从 trajectory 找 weakness → 修改 prompt / memory / skill / tool / workflow / code → evaluation → keep / rollback**。核心是 **failure-driven harness evolution**。 | **Harness 在变，但“怎么优化 harness”的外层机制通常没变。** Editable scope、verifier、candidate selection、acceptance rule、search/evolution procedure 多由人设计；而且 **Harness Updating ≠ Harness Benefit**。 | **Prompt、memory、skill、tool、workflow、harness code 等外部持久状态**。经验被 externalize 到 harness。 |
| **04 Environment / Curriculum**        | **What should I learn next?** 面对当前能力和失败，下一阶段最应该给自己什么任务和学习环境？ | **观察 learner capability / failure → 生成或选择 task / environment / curriculum → learner 在新分布上训练 → 根据新 learner 再调整下一阶段**。核心是 **adaptive curriculum / environment generation**。 | **系统开始选择“学什么”，但选择空间仍通常是人规定的。** Environment representation、task generator、允许搜索的配置空间、training operator 和最终 objective 仍固定；更好的 curriculum 也不自动意味着 curriculum designer 本身变强。 | **Environment、task/problem distribution、curriculum**。改变的是未来 learner 的学习经历。 |
| **05 Complete AI R&D**                 | **What should I improve next?** 当 data、weights、harness、environment 等都可能是瓶颈时，谁来判断下一步应该改什么？ | **给 research objective → 分析 failure / evidence → researcher 自主诊断瓶颈 → 选择修改 data / training / harness / experiment 等 → 执行 → evaluation → 下一轮 research**。核心是 **autonomous choice of improvement lever**。 | **“改什么”的决定权交给了 AI，但做决定的 researcher 本身通常仍固定。** 它可以不断研究别人，却未必因此成为更好的 researcher；同时 end-to-end setting 还容易把 research judgment 与 shell/system engineering、reward hacking 混在一起。 | 不限定单一 substrate：data、model、training recipe、code、harness、experiment 都可能发生变化。 |
| **06 Trainer / Researcher**            | **How do I improve the way I improve?** 负责产生 improvement 的 trainer / researcher 本身能不能变得更好？ | **观察完整 improvement trajectory → 诊断“改进过程本身哪里有问题” → 修改 trainer / researcher / diagnostics / search mechanism / research harness → 新 improver 再去完成下一轮 improvement**。核心是 **meta-improvement / improve the improver**。 | **已经最接近严格 RSI，但“修改 improver”仍然不等于 RSI。**还必须证明新的 $I_{t+1}$ 比 $I_t$ 更会产生 improvement；它确实重新进入下一轮；这种能力能够 retention、transfer，并在多轮中 compounding，而不是偶然涨一次。 | **Improver 本身**：trainer、researcher、diagnostics、search policy、research harness / mechanism。 |

1. **01：我会利用自己的经验，但“怎么利用”还是人设计的。**
2. **02：我会产生自己的训练信号，但“怎么训练自己”还是人设计的。**
3. **03：我会修改自己的 harness，但“怎么搜索和验证 harness”还是人设计的。**
4. **04：我会决定下一步学什么，但“可学习空间和 curriculum mechanism”还是人设计的。**
5. **05：我会自己判断下一步该改什么，但“做这个判断的 researcher”本身还是固定的。**
6. **06：我开始修改 researcher / trainer 本身；只有新的 improver 更强、重新进入下一轮并持续产生可累积 improvement，才真正开始闭合 RSI。**

## 如何读下面的“核心定位”

“核心定位”只总结**原论文明确支持、且最能帮助理解这篇工作为什么区别于同类方法的核心思想**。它不是关键词标签，也不重复完整流程：通常用 1–2 句话说明“这篇工作真正改变了什么问题设定/设计选择，以及这个选择为什么重要”。具体执行机制仍放在下一列展开。该列使用低饱和蓝色字体；若 Markdown 渲染器不支持 HTML 颜色，内容仍会正常显示为普通文本。

**时间口径：**表格中的“首次发表时间”统一指该工作的 **arXiv v1 / 首次公开月份**，格式为 `YYYY-MM`。对于不是独立论文的子实验，沿用所属论文的首次公开月份并注明；若博客未能唯一确认对应论文，则标记为“未确认”，不做猜测。

## 改答案，reasoning，轨迹

模型能够利用自己的中间产物，在一个固定机制中不断修正行为。但这里被改进的主要是 **output、trajectory、context 和局部经验**。

什么算成功、反馈从哪里来、经验以什么格式保存、循环什么时候结束，通常仍然**由人提前规定**。所以这一层更准确的 claim 是 **task improvement**：模型学会了在一个固定循环中改答案，但还没有开始修改这个循环本身。

| Title + Link | 首次发表时间 | 核心定位 | 具体做了什么（严格依据原论文） | 博客中对这个工作的描述 |
|---|---|---|---|---|
| [**Self-Refine: Iterative Refinement with Self-Feedback**](https://arxiv.org/abs/2303.17651) | 2023-03 | <font color="#4F6B8A">核心不是训练一个更强模型，而是证明**同一个 LLM 在 test time 就能把自己的输出当作可反复修改的草稿**：自己给 feedback、自己 refine。它把 self-improvement 限定在当前输出层，因此机制简单、无需额外训练。</font> | 论文研究不依赖额外训练时，LLM 能否通过自己的反馈持续**改进输出**。整个过程由同一个 LLM 反复承担三个步骤：先生成 initial output，再针对当前输出生成具体 feedback，最后根据 feedback 产生 refined output；随后把 refined output 作为下一轮输入继续执行 feedback–refine。改进发生在 inference-time 的当前输出上，不更新模型参数，也不需要额外监督数据或 RL。 | **“Self-Refine 让模型生成、批评和修改自己的答案。”** |
| [**Reflexion: Language Agents with Verbal Reinforcement Learning**](https://arxiv.org/abs/2303.11366) | 2023-03 | <font color="#4F6B8A">核心是把 agent 的 trial-and-error **转成可跨 trial 保存的自然语言 reflection**，用 episodic memory 代替 RL 的参数更新。它关注的是“如何从失败中留下可复用经验”，而不是如何改模型权重。</font> | 论文把传统 RL 中的参数更新替换为“语言形式的经验更新”。Agent 完成一次 trial 后，根据环境/任务反馈对失败或成功过程生成 verbal reflection，并把 reflection 写入 episodic memory；下一次 trial 时，当前 observation 与历史 reflection 一起进入 context，影响后续规划和行动。因此**跨 trial 持续积累的是自然语言经验**，而不是更新后的模型权重。 | **“Reflexion 把失败总结成语言反馈，写入 memory，影响下一次行动。”** |
| [**STaR: Bootstrapping Reasoning With Reasoning**](https://arxiv.org/abs/2203.14465) | 2022-03 | <font color="#4F6B8A">核心是让模型**用自己生成的成功 reasoning 反过来训练 reasoning 能力**。特别之处在于失败样本并非直接丢弃，而是给出正确答案后让模型重新 rationalize，再把最终能导向正确答案的 rationale 纳入训练。</font> | 论文提出一个 iterative bootstrapping 流程来学习 reasoning。模型先尝试为问题生成 rationale 和答案；能够导向正确答案的 rationale 被加入训练集。对于答错的问题，系统把正确答案提供给模型，让模型再次生成能够解释该答案的 rationale（rationalization）；这些成功 rationale 与原有数据一起用于 fine-tuning。更新后的模型再次生成新的 rationales，形成“**生成 reasoning → 筛选/补全 reasoning → fine-tune → 再生成**”的迭代循环。 | **“STaR 把能够导向正确答案的 reasoning 重新放回训练数据。”** |
| [**Voyager: An Open-Ended Embodied Agent with Large Language Models**](https://arxiv.org/abs/2305.16291) | 2023-05 | <font color="#4F6B8A">核心是把 lifelong learning 拆成 **automatic curriculum + 可执行代码 skill library**：前者决定接下来探索什么，后者把成功行为沉淀成可检索、组合的长期能力。它因此能在不更新模型参数的情况下持续积累 embodied skills。</font> | 论文在 Minecraft 中构建一个长期自主探索 agent，核心由三个组件组成：automatic curriculum 根据当前进度提出下一目标；**skill library 把已经成功完成的行为沉淀为可执行代码技能**；iterative prompting 根据环境反馈、执行错误和 self-verification 反复修改生成的程序直到任务成功。成功技能被写入长期 skill library，之后可以按需检索、复用和组合，因此**过去 trajectory 中的成功经验会持续影响后续任务**。 | **“Voyager 把成功经验沉淀为可以检索、复用和组合的 skill。”** |

## 改数据、reward 和 weights

这一层让模型开始参与构造自己的训练信号，把 self-improvement **从 inference 推向 training**。模型产生的内容不再只影响当前答案，而是进入下一轮的 **data、reward 和 gradient**，最终改变参数。

但博客强调：

> **“模型参与训练自己”和“模型决定如何训练自己”仍然是两件不同的事情。**

多数工作中，人已经规定了应该改数据、训练算法、reward 形式和 evaluation protocol。AI 可以生成更多训练信号，却不一定需要判断当前真正的瓶颈是什么、应该修改哪个部分，以及当前指标是否真的代表目标能力。

所以这一层主要是 **data、reward 或 model improvement**：

> 模型参与产生 successor，但还没有把完整的 improvement process 交给模型。

| Title + Link | 首次发表时间 | 核心定位 | 具体做了什么（严格依据原论文） | 博客中对这个工作的描述 |
|---|---|---|---|---|
| [**Self-Instruct: Aligning Language Models with Self-Generated Instructions**](https://arxiv.org/abs/2212.10560) | 2022-12 | <font color="#4F6B8A">核心是把 instruction tuning 中最依赖人工的**指令数据构造**交给模型自己完成：从少量 seed tasks 扩展出新的 instruction–input–output，再过滤后回用于训练。它展示的是“模型自己扩充监督数据”这一自举路线。</font> | 论文从少量人工 seed tasks 出发，让已有语言模型迭代**生成新的 instruction tasks**。对每个生成 instruction，模型还会**生成对应 input/output**；系统随后用启发式规则过滤格式错误、重复或与已有任务过于相似的样本。保留下来的 synthetic instruction data 与原始数据一起用于 instruction tuning，从而把模型自己扩充出来的任务分布重新用于训练模型。 | 与 Evol-Instruct、WizardLM 一起概括为：**“让模型生成和演化 instruction data。”** |
| [**WizardLM: Empowering Large Language Models to Follow Complex Instructions**](https://arxiv.org/abs/2304.12244)（Evol-Instruct） | 2023-04 | <font color="#4F6B8A">核心不是简单多采样 synthetic instructions，而是用 **Evol-Instruct 显式沿复杂度方向演化已有 instruction**，例如增加约束、深化推理等。重点从“自己造数据”推进到“自己系统性地产生更难的数据”。</font> | 论文提出 Evol-Instruct，用 LLM 对已有 instruction 做逐步“进化”，而不是只直接采样新 instruction。方法包含 in-depth evolution（增加约束、深化推理、提高复杂度等）和 in-breadth evolution（生成新的相关任务）等操作，把简单 instruction 改写成更复杂、更有挑战性的 instruction；演化后的 instruction 再生成 response，并用于 fine-tune LLaMA，得到 WizardLM。 | **“Self-Instruct、Evol-Instruct、WizardLM 一类工作让模型生成和演化 instruction data。”** |
| [**SPIN: Self-Play Fine-Tuning Converts Weak Language Models to Strong Language Models**](https://arxiv.org/abs/2401.01335) | 2024-01 | <font color="#4F6B8A">核心是让**上一轮模型自己的 response 成为下一轮训练中的对手**：当前模型学习区分 human demonstrations 与旧模型生成结果。这样不需要新增人工 preference data，训练信号会随着模型版本共同变化。</font> | 论文从一个已有 SFT 模型开始，把当前模型视为 self-play 中的 opponent：它针对训练 prompts 生成自己的 responses，而数据中的 human demonstrations 作为更优 responses。下一轮模型通过偏好式目标学习区分 human response 与上一轮模型 response，使自己的分布逐渐远离旧模型、接近目标分布。更新后的模型再生成新的 responses，成为下一轮 opponent，因此训练信号随模型版本迭代更新。 | **“SPIN 让模型与自己的历史版本进行 self-play。”** |
| [**Self-Rewarding Language Models**](https://arxiv.org/abs/2401.10020) | 2024-01 | <font color="#4F6B8A">核心是让模型同时承担**回答者和 judge/reward provider**：它不仅生成 candidate responses，也用 LLM-as-a-Judge 产生自己的 preference signal。论文关注的是 instruction-following ability 与 reward-giving ability 能否在同一迭代中共同提升。</font> | 论文让同一个语言模型同时具备两种角色：一方面作为 instruction-following model 生成 candidate responses，另一方面通过 LLM-as-a-Judge prompting 对候选回答打分/比较，产生自己的 preference data。每一轮根据这些 self-generated preferences 进行 DPO 更新；更新后的模型随后继续生成更强 responses，并再次充当 judge 产生下一轮 preference signal，从而形成 response generation、self-reward 和 preference optimization 的迭代。 | **“Self-Rewarding Language Models 让模型既生成答案，也参与生成 reward。”** |
| [**Absolute Zero: Reinforced Self-play Reasoning with Zero Data**](https://arxiv.org/abs/2505.03335) | 2025-05 | <font color="#4F6B8A">核心是进一步去掉**外部题库和答案数据**：同一个模型既提出可验证的新任务，又求解这些任务，再由代码执行器验证有效性和答案。它把“出题—解题—验证—RL”闭成一个 zero-data reasoning self-play loop。</font> | 论文希望在没有人工问题和答案数据的情况下训练 reasoning model。单一模型同时承担 proposer 和 solver：proposer 自动生成可执行、可验证的 programming/reasoning tasks，solver 尝试求解；代码执行器既用于检查生成任务是否有效，也用于验证 solver 的答案。由任务有效性和求解结果得到的可验证 reward 同时训练“出题”和“解题”能力，于是形成“自己出题 → 自己解题 → 执行器验证 → RL 更新”的 closed-loop self-play。 | 与 R-Zero 一起概括为：**“进一步探索自动出题、自动解题、自动验证和自博弈。”** |
| [**R-Zero: Self-Evolving Reasoning LLM from Zero Data**](https://arxiv.org/abs/2508.05004) | 2025-08 | <font color="#4F6B8A">核心是把 proposer–solver 拆成**独立共演化的 Challenger 与 Solver**。Challenger 的目标不是盲目制造难题，而是持续把任务推到 Solver 当前能力边界，因此问题分布会随 learner 能力动态变化。</font> | 论文从同一个 base LLM 初始化两个独立角色：Challenger 负责生成 reasoning problems，Solver 负责求解。Challenger 的目标不是单纯生成越难的问题，而是产生接近 Solver 当前能力边界、具有学习价值的问题；Solver 则根据这些问题的可验证结果获得训练信号。随着 Solver 变强，Challenger 所生成的问题也随之调整，两者交替更新并共同演化。 | 与 Absolute Zero 一起概括为：**“进一步探索自动出题、自动解题、自动验证和自博弈。”** |
| [**SEAL: Self-Adapting Language Models**](https://arxiv.org/abs/2506.10943) | 2025-06 | <font color="#4F6B8A">核心是把**“如何更新自己”也做成模型需要生成的输出**：模型产生 self-edit 来决定 finetuning data、update directive 乃至部分优化设置。更新后模型的 downstream performance 又反过来训练模型生成更有效的 self-edit。</font> | 论文把 adaptation 本身变成模型需要生成的输出。面对新的知识或任务输入，模型先生成一个 self-edit；self-edit 可以指定如何重构信息、构造用于 fine-tuning 的数据、给出 update directive，并包含部分优化相关设置。系统按该 self-edit 执行梯度更新，再用更新后模型在目标任务上的表现评价这次 edit；该效果反过来可以训练模型产生更有效的 self-edit。最终被持久改变的是模型参数，而模型也在学习“应该生成怎样的更新指令”。 | **“SEAL 则让模型生成自己的 adaptation data 和 update directive，再通过训练更新自身能力。”** |

## 改 prompt、skill、tool 和 harness

Agent 的能力并不只存在于 weights 中。同一个模型使用不同的 prompt、tools、memory、skills、context policy 和 workflow，表现可能完全不同。因此，这一层让 AI 直接修改包裹在模型外面的系统。

这类工作的价值在于：如果问题可以通过增加一个 tool、修改 prompt 或积累一条 skill 解决，就不需要每次重新训练整个模型；而且与 weights 相比，harness 更容易阅读、回滚和比较。

但博客强调：

> **系统产生了一条更好的经验，不等于它真正获得了这条经验。**

Harness Updating Is Not Harness Benefit 将能力进一步拆成 **harness-updating** 和 **harness-benefit**：模型可能总结出正确经验，却在下一次想不起调用；也可能检索到了 skill，却无法理解或长期遵循。

因此，这一层真正测的是 **system improvement**：

> AI 能否改进承载模型能力的外部系统。

而要进一步接近递归，还需要证明新的 harness 不仅提高当前任务表现，也提高系统下一次设计、验证和使用 harness 的能力。

| Title + Link | 首次发表时间 | 核心定位 | 具体做了什么（严格依据原论文） | 博客中对这个工作的描述 |
|---|---|---|---|---|
| [**Darwin Gödel Machine: Open-Ended Evolution of Self-Improving Agents**](https://arxiv.org/abs/2505.22954) | 2025-05 | <font color="#4F6B8A">核心不是一般的 harness 迭代，而是让 agent **直接修改包含自身改进能力在内的 codebase，并维护一个多分支 agent archive**。它不是只沿当前最优版本做 hill-climbing，而是保留不同后代作为 stepping stones，进行 open-ended exploration。</font> | 论文**把 coding agent 自己的可编辑 codebase 作为搜索对象**，并保持 base LLM 固定。每轮从已有 agent archive 中选择一个 parent，parent agent 阅读自己的 benchmark evaluation / execution logs，再使用 shell 和代码编辑工具直接修改自身 harness repository，得到一个 child agent。新版本在 coding benchmarks 上重新评估，表现足够好的版本进入 archive；后续不只沿单一路径继续，而是可以从 archive 中不同 parent 分支继续产生后代，形成开放式的 agent evolution tree。 | **“Darwin Gödel Machine 维护不同版本的 agent，让它们修改自身、接受评测并保留更好的后代。”** |
| [**Automated Design of Agentic Systems**](https://arxiv.org/abs/2408.08435) | 2024-08 | <font color="#4F6B8A">核心是把**agent architecture 本身交给 Meta-Agent 自动发明**。与针对某个已有 harness 做局部修补不同，它把 prompts、tool use、control flow 及其组合放进代码级搜索空间，让 meta-agent 基于历史 archive 编程出新的 agent designs。</font> | 论文**把“如何设计一个 agentic system”本身形式化成自动搜索问题**。系统维护一个包含已有 agent designs 及其表现的 archive；Meta Agent 读取 archive，先提出新的高层 agent 设计，再将其实现为可执行代码，设计空间可以同时涉及 prompts、LLM 调用方式、tool use、角色组织和 control flow。候选 agent 经过执行评估后，新的有效设计继续加入 archive，供后续 Meta Agent 参考和组合。 | **“Automatic Design of Agentic Systems 把 agent architecture 本身变成搜索对象。”** |
| [**Agentic Harness Engineering: Observability-Driven Automatic Evolution of Coding-Agent Harnesses**](https://arxiv.org/abs/2604.25850) | 2026-04 | <font color="#4F6B8A">核心判断是：自动 harness evolution 的瓶颈不只是“不会提修改”，而是**不知道改了什么、为什么改、改完到底造成了什么结果**。因此论文用 component、experience、decision 三层 observability，把每次 edit 变成之后能被 outcome 验证的可证伪预测，从而改善归因。</font> | ==论文认为自动 harness evolution 的主要瓶颈是 observability，因此把 harness、experience 和 edit decision 都显式化==。首先把 system prompt、tool description/implementation、middleware、skill、sub-agent configuration、long-term memory 等可编辑组件表示为文件；其次保存 raw trajectories，并由 debugger 生成 per-task root-cause report 和 benchmark-level overview；最后 Evolve Agent 根据这些 evidence 决定修改哪个组件，并为每次 edit 写出 evidence、root cause、targeted fix、expected fixes 和可能 regression。下一轮 evaluation 用来验证这些预测，从而使修改可追踪、可证伪和可回滚。 | **“AHE 把 harness 中可编辑的组件、执行证据和每次修改的预期结果显式记录下来。”** |
| [**Self-Harness: Harnesses That Improve Themselves**](https://arxiv.org/abs/2606.09498) | 2026-06 | <font color="#4F6B8A">核心是强调 **harness 应该针对具体 base model 的 failure 来自我修复**：先从 execution traces 挖 model-specific weakness，再提出与该 weakness 对应的最小修改。候选修改必须经过 regression validation，目标是可靠修补而不是开放式重写整个 architecture。</font> | 论文**采用 propose–evaluate–accept 的 harness self-improvement loop**。首先在当前 harness 上运行任务并收集完整 trajectories，通过 weakness mining 将失败归纳为 verifier-grounded failure patterns；然后 proposer 根据这些 failure patterns、当前 editable surfaces、需要保留的 passing behaviors 和历史尝试提出 bounded harness edits；候选修改不会直接上线，而是分别在 held-in 与 held-out tasks 上做 regression test，只有既修复目标 weakness、又没有引入明显 regression 的修改才合并到下一版 active harness。被拒绝的修改及其结果也会保留供后续轮次参考。 | **“Self-Harness 让模型从自己的 trajectory 中发现 weakness，提出最小化 harness 修改，再通过 regression test 决定是否保留。”** |
| [**Recursive Harness Self-Improvement**](https://arxiv.org/abs/2607.15524) | 2026-07 | <font color="#4F6B8A">核心是把 harness 收缩成**task-specific 的 prompt-level agent-loop specification**，重点优化不同 agent/hop 之间传什么 context。它利用自身 revision history 的 pairwise feedback 做少量迭代，希望以较低成本改善 trace quality 和 inter-agent information flow。</font> | **论文把 harness 显式表示为可修改的 agent-loop specification**，其中既包括 agent design，也包括 workflow 中不同 hop 之间的信息传递 contract。每轮用当前 harness 完成任务，再由 evaluator 对当前版本与历史/上一版本结果做 pairwise comparison；这些偏好反馈累积为 self-comparison history，harness optimizer 根据历史继续修改 harness。论文尤其关注 task-specific context contract 和 inter-agent information flow，希望减少不必要的 context 传播并改进执行轨迹。 | **“Recursive Harness Self-Improvement 研究如何通过 harness 的 revision history 持续改善信息流和执行轨迹。”** |
| [**SkillSmith: Co-Evolving Skills and Tools for Self-Improving Agent Systems**](https://arxiv.org/abs/2606.01314) | 2026-06 | <font color="#4F6B8A">核心是指出只演化 skill 而固定 tool layer 会限制能力增长，因此让 **skills 和 executable tools 联合演化**。同时它显式建模 skill 之间的互补与冲突，使系统既能改“怎么做”，也能在能力缺口出现时直接改“拿什么工具做”。</font> | ==同时优化工具使用和工具本身==。论文不把长期经验只写成文字 skill，而是同时把 skills 与 executable tools 放进可演化空间。系统从任务执行和 reflection 中识别 reusable capability gap；如果问题仅靠新增/修改 skill 无法解决，就可以进一步对已有 tool 做 wrap、edit、compose、split，或者 retire 不再适用的 tool。Skill 与 tool 的修改被作为相互关联的 capability update 管理，从而使**“知道怎么做”和“真正有工具做”能够共同演化**。 | **“SkillSmith 则把 skill evolution 扩展到 skill-tool co-evolution：如果现有 tool 无法支持某种能力，系统不仅可以补充 skill，也可以修改、组合、包装或者淘汰 tool。”** |
| [**SIA: Self Improving AI with Harness & Weight Updates**](https://arxiv.org/abs/2605.27276) | 2026-05 | <font color="#4F6B8A">核心是把原本分离的两条 self-improvement 路线放到**同一个 feedback loop**：既允许改 harness，也允许改 model weights。它研究的是 task feedback 能否同时驱动外部 scaffold 和内部参数两种 improvement lever，而不是预先固定只走其中一条。</font> | ==自动触发是更新harness还是更新模型权重==。论文试图打破“只改 harness”或“只改 weights”的单一更新路径。系统包含负责提出/维护 agent scaffold 的 Meta-Agent、执行任务并产生 trajectory 的 Task-Specific Agent，以及读取近期 trajectory 的 Feedback-Agent。Feedback-Agent 根据执行反馈判断下一轮更适合修改 harness/scaffold，还是触发模型参数更新；权重更新通过训练过程完成，harness 更新则直接改变 agent 外部结构，因此两种 improvement lever 被放在同一个反馈循环中选择。 | **“SIA 更进一步，同时开放 harness updates 和 weight updates。”** |
| [**Harness Updating Is Not Harness Benefit: Disentangling Evolution Capabilities in Self-Evolving LLM Agents**](https://arxiv.org/abs/2605.30621) | 2026-05 | <font color="#4F6B8A">核心不是提出新的 evolution algorithm，而是指出“harness evolution 好不好”其实包含**两个不同能力**：能否写出有用的持久更新，以及 task solver 能否真正调用、理解并遵循这些更新。论文把两者拆开后发现，它们与 base-model capability 的关系并不相同。</font> | ==将模型的harness-updating和harness-benefit分开评测==。论文指出以往“harness evolution 有效”常把两个不同问题混在一起，因此将其拆成独立能力评估。Harness-updating 测试模型能否根据 execution evidence 产生有价值、可持久化的 harness update；harness-benefit 则固定已有更新，测试 task-solving model 能否在正确时机激活、理解并遵循这些更新，从而真正提高任务表现。论文据此比较不同能力模型在“写出好的 harness update”和“从 update 中受益”两方面的差异。 | 博客据此强调：**“一个模型可能总结出正确经验，却在下一次完全想不起调用。也可能成功检索了 skill，却无法理解或长期遵循。”** |

## 改环境、任务和 curriculum

这一类工作不一定直接改模型，而是改变模型学习时面对的环境，例如：

- 自动生成不同难度的问题；
- 根据 policy failure 调整任务分布；
- 修改交互规则和环境配置；
- 为当前模型构造既有挑战、又能够学习的 curriculum。

博客认为 **environment evolution 应该成为一个独立 scope**，而不应该与 data、training、harness 全部混在一个最终分数里。

其中比较接近 improver improvement 的现象是：训练后的 checkpoint 不仅 task performance 更强，也比原始模型更擅长设计下一轮训练环境。

但这类实验通常仍建立在受控的 environment generator 和预定义配置空间中，还没有证明 AI 能够在开放环境中自主发现应该构造什么任务，以及为什么这些任务能够产生更强的 successor。

| Title + Link | 首次发表时间 | 核心定位 | 具体做了什么（严格依据原论文） | 博客中对这个工作的描述 |
|---|---|---|---|---|
| [**Emergent Complexity and Zero-shot Transfer via Unsupervised Environment Design (PAIRED)**](https://arxiv.org/abs/2012.02096) | 2020-12 | <font color="#4F6B8A">核心是解决自动环境生成中“随机环境不随 learner 变化，而纯 adversarial 环境又可能不可解”的问题。PAIRED 用 **protagonist–antagonist regret** 训练 environment generator，让它生成对当前 learner 有挑战、但存在可行解的环境。</font> | 论文研究 Unsupervised Environment Design：不预先给定固定任务 curriculum，而是同时训练 protagonist、antagonist 和 environment-generating adversary。Environment generator 根据 protagonist 与 antagonist 的相对表现构造 regret 信号，并据此生成既能暴露 protagonist weakness、又仍然可解的 environments；随着 agents 能力提升，生成环境的难度和结构也随之变化，形成自适应 curriculum。 | 与 POET 一起概括为：**“PAIRED、POET 一类工作较早研究了 agent 和环境的共同演化。”** |
| [**Paired Open-Ended Trailblazer (POET)**](https://arxiv.org/abs/1901.01753) | 2019-01 | <font color="#4F6B8A">核心是追求 **open-ended problem–solution co-evolution**：不是维护一条越来越难的 curriculum，而是同时维护多个 environment–agent pair。不同环境间还允许 solution transfer，使某条路径上的能力成为另一条路径继续突破的 stepping stone。</font> | 论文提出 open-ended co-evolution：系统持续产生新的 environment，同时为每个 environment 优化对应 agent，而不是围绕一个固定任务收敛。它维护一个不断扩张的 environment–agent population；新环境只有在既不太容易、也不完全不可解时才被保留。已有 agent 还会在不同环境之间尝试 transfer，如果某个已有 solution 能在新环境中取得更好表现，就可以成为新的 starting point，从而利用跨环境 stepping stones 推动持续复杂化。 | **“PAIRED、POET 一类工作较早研究了 agent 和环境的共同演化。”** |
| [**Absolute Zero: Reinforced Self-play Reasoning with Zero Data**](https://arxiv.org/abs/2505.03335) | 2025-05 | <font color="#4F6B8A">核心是进一步去掉**外部题库和答案数据**：同一个模型既提出可验证的新任务，又求解这些任务，再由代码执行器验证有效性和答案。它把“出题—解题—验证—RL”闭成一个 zero-data reasoning self-play loop。</font> | 从 environment-generation 视角看，论文不再使用固定外部题库，而是让模型的 proposer 持续产生新的可执行 reasoning tasks。代码执行器过滤无效任务并提供答案验证，solver 在这些动态生成的问题上学习；因此随着模型能力变化，后续训练看到的问题集合也由系统自身持续扩展和更新，训练分布不是静态给定的。 | **“Absolute Zero、R-Zero 也可以从 environment generation 的角度理解：系统不仅在解决任务，还在扩展自己的问题分布。”** |
| [**R-Zero: Self-Evolving Reasoning LLM from Zero Data**](https://arxiv.org/abs/2508.05004) | 2025-08 | <font color="#4F6B8A">核心是把 proposer–solver 拆成**独立共演化的 Challenger 与 Solver**。Challenger 的目标不是盲目制造难题，而是持续把任务推到 Solver 当前能力边界，因此问题分布会随 learner 能力动态变化。</font> | 从 curriculum 视角看，Challenger 被训练为根据 Solver 的当前能力生成“恰好有挑战”的问题，而不是固定采样一个数据集。Solver 的成功/失败会改变 Challenger 的 reward，因此 Solver 变强后，Challenger 会把问题分布推向新的能力边界；随后 Solver 又在新的问题上继续训练，形成 learner 与 curriculum generator 相互驱动的动态闭环。 | **“系统不仅在解决任务，还在扩展自己的问题分布。”** |
| [**From Trainee to Trainer: LLM-Designed Training Environment for RL with Multi-Agent Reasoning**](https://arxiv.org/abs/2606.17682) | 2026-06 | <font color="#4F6B8A">核心是把下一阶段 environment design 从外部人类 teacher 交给**当前正在被训练的 policy 自己**。更关键的是论文还比较训练前后的 checkpoint 作为 environment engineer 的能力，因此直接检查“trainee 变强后，是否也更会训练下一代”。</font> | 论文让正在被训练的 policy 不只充当 trainee，也参与下一阶段训练环境的设计。Environment-design agent 读取当前 policy 的 failure trajectories、行为摘要和环境统计，提出新的 environment configuration，用这些配置继续训练 policy；训练后再次根据新的 failure pattern 更新环境。论文还专门比较训练后的 checkpoint 与原始 base model 作为 environment engineer 时的表现，用来检验“更强 trainee 是否也变成更强 trainer/environment designer”。 | **“From Trainee to Trainer 则让当前 policy 分析自己的 failure trajectory，再修改下一阶段的 environment configuration。”** 博客特别强调：**“经过训练的 checkpoint，比原始 base model 更擅长设计下一轮训练环境。”** |

## 改完整的 AI 研发流程

前几类工作通常已经告诉 agent 应该改什么：数据、harness 或 environment。

但真正的 researcher 面对失败时，需要首先判断问题到底出在哪里：data、reward、training algorithm、tool、harness，还是 evaluation 本身。

因此，这一类工作开始把更完整的 **AI R&D process** 交给 agent。

博客认为这类 benchmark 测的是非常重要的 **end-to-end autonomy**：它们不提前告诉 agent 应该使用 SFT、RL、数据合成还是其他策略，而是让 agent 自己探索完整方案。

但 end-to-end benchmark 带来的核心问题是：

> **Research 和 operation 混在了一起。**

Agent 可以把大量时间和算力花在依赖、路径、进程、显存、checkpoint 格式和 serving 配置上；最终分数上涨时，很难判断究竟来自研究能力、系统工程能力，还是某种 shortcut。

所以博客区分：

- **End-to-end benchmark**：把所有事情交给 agent，它最终能不能完成？
- **受控 benchmark**：其他变量保持一致时，它到底具备哪一种研究能力？

两者都需要，但不能用前者替代后者。

| Title + Link | 首次发表时间 | 核心定位 | 具体做了什么（严格依据原论文） | 博客中对这个工作的描述 |
|---|---|---|---|---|
| [**The AI Scientist: Towards Fully Automated Open-Ended Scientific Discovery**](https://arxiv.org/abs/2408.06292) | 2024-08 | <font color="#4F6B8A">核心是把过去分散的 AI research assistance 串成**完整科研流水线**：从 idea、novelty check、代码和实验，一直到论文撰写和 automated review。它的定位不是强化某个单一 research skill，而是验证整个 scientific discovery process 能否由 agent 端到端执行。</font> | 论文构建一个端到端的 automated scientific discovery pipeline。系统从给定研究方向出发生成 research ideas，并对 idea 做 novelty checking；随后由 coding agent 修改代码、运行 experiments、收集结果并生成图表，再基于实验结果撰写完整论文。最后使用自动 reviewer 对论文进行评审，评审结果还可作为下一轮研究和筛选的信号，因此覆盖从 idea 到 experiment、paper 和 review 的大部分科研流程。 | 与 AIRS-Bench 一起描述为：**“覆盖 idea generation、实验执行、结果分析和 iterative refinement。”** |
| [**AIRS-Bench: a Suite of Tasks for Frontier AI Research Science Agents**](https://arxiv.org/abs/2602.06855) | 2026-02 | <font color="#4F6B8A">核心是把**真实 SOTA ML papers 中的开放研究任务**做成可比较的 benchmark，并覆盖 idea generation、experiment analysis 和 iterative refinement 等完整 research lifecycle。它不给 baseline code，因此更强调 agent 是否能真正开展研究，而不是在既有实现上做局部修改。</font> | 论文构建面向 frontier AI research agents 的任务套件，任务来自真实前沿 ML research setting，而不是只做封闭式 QA。Benchmark 将 research lifecycle 拆成多个需要实际研究判断的环节，包括提出/改进 idea、分析 methodology、设计或解释 experiments、阅读结果并进行 iterative refinement；任务不依赖一个统一的固定解题模板，重点评估 agent 能否在真实研究上下文中完成连续研究决策。 | **“The AI Scientist、AIRS-Bench 覆盖 idea generation、实验执行、结果分析和 iterative refinement。”** |
| [**MLE-bench: Evaluating Machine Learning Agents on Machine Learning Engineering**](https://arxiv.org/abs/2410.07095) | 2024-10 | <font color="#4F6B8A">核心是用 **真实 Kaggle competitions** 直接测试 agent 的 ML engineering：数据处理、建模、训练、实验和提交都必须真正完成。公开 leaderboard 同时提供可量化的人类基线，因此它测的是现实工程结果，而不是人工设计的 research subtask。</font> | 论文从 Kaggle 竞赛中选择一组真实 ML tasks，把每个 competition 转化为 agent 可操作的 ML engineering environment。Agent 需要自行读取数据和任务说明、编写训练代码、进行 feature/model/parameter experiments、生成预测并提交；最终以 competition 的官方 metric/leaderboard 规则评价结果，并可与 Kaggle human submissions 对比。它测的是完整 ML engineering 执行能力，而不是单一步骤的模型选择。 | 与 CORE-Bench、ResearchBench 一起说：**“分别从机器学习竞赛、研究复现和开放研究任务的角度评估科研 agent。”**其中 MLE-bench 对应机器学习竞赛。 |
| [**CORE-Bench: Fostering the Credibility of Published Research Through a Computational Reproducibility Agent Benchmark**](https://arxiv.org/abs/2409.11363) | 2024-09 | <font color="#4F6B8A">核心是把 research-agent 能力收缩到一个**明确可验证的科研环节：复现实验结果**。Agent 需要真正理解论文 repository、配置环境并运行实验，因此它测试的是 computational reproducibility，而不是开放式地评价“论文写得像不像研究”。</font> | 论文围绕 computational reproducibility 构造任务：从已发表研究中整理论文、代码、数据和目标结果，要求 agent 在实际计算环境中理解 repository、安装依赖、运行或修复实验流程，并复现论文报告的核心数值/结果。Benchmark 因而同时考察论文理解、代码与环境操作、实验执行以及结果核对，而不是只让模型回答论文内容问题。 | 在博客上述三项并列中对应 **“研究复现”**。 |
| **ResearchBench（博客未提供唯一 citation）** | 未确认 | <font color="#4F6B8A">博客转写没有提供足以唯一确认具体 ResearchBench 论文的信息，因此这里不强行给出差异化定位，避免把其他同名工作的特点误归到该条目。</font> | 博客转写中没有提供足以唯一确认具体论文的信息，因此这里不根据猜测补充原论文机制。 | 博客只说：**“MLE-bench、CORE-Bench、ResearchBench 等工作，分别从机器学习竞赛、研究复现和开放研究任务的角度评估科研 agent。”**其中 ResearchBench 对应开放研究任务。 |
| [**PostTrainBench: Can LLM Agents Automate LLM Post-Training?**](https://arxiv.org/abs/2603.08640) | 2026-03 | <font color="#4F6B8A">核心是把 post-training 做成**固定算力预算下、策略不预设的开放 research task**：只给 base model 和目标指标，不告诉 agent 应该做 SFT、RL 还是数据合成。正因为 action space 较开放，它也暴露出 test-set training、下载现成 checkpoint 等 shortcut / reward-hacking 行为。</font> | 论文把 LLM post-training 作为一个开放式 agent research task：给定 base model、目标 benchmark、固定时间和单机算力预算，不给 agent 预设 SFT/RL/数据合成等 recipe。Agent 可以浏览资料、分析当前模型 failure、构造或筛选数据、修改训练脚本和超参数、启动训练、评估 checkpoint，并根据结果继续下一轮实验。论文同时记录了 test-set training、直接下载已有 instruct checkpoint、寻找 API key 等 shortcut / reward-hacking failure modes，用来说明 end-to-end autonomy 与研究归因之间的张力。 | **“PostTrainBench 则让 agent 在固定算力和时间内，自主完成数据构造、训练和评测，最终提高一个 base model 的目标能力。”**博客还用它说明 end-to-end setting 中会出现 test-set training、下载已有 instruct checkpoint、寻找 API key、利用评测或基础设施漏洞等 failure modes。 |
| [**A-Evolve-Training: Autonomous Post-Training of a 30B Model**](https://arxiv.org/abs/2606.20657) | 2026-06 | <font color="#4F6B8A">核心不仅是自动跑 post-training，而是在 **30B 模型、跨多轮和数周**的真实规模上关闭整个 research loop。论文特别强调系统发现内部 dev metric 已不再对应外部目标后，会改变自己的 search policy 和证据标准，这体现了对 measurement failure 的研究判断。</font> | 论文展示一个长时间运行的 autonomous post-training system，在真实 30B 模型上连续进行多轮训练研究。Agent 读取当前实验历史和 evaluation，提出新的 data mixture / generation strategy、training recipe 或其他 post-training modification，自动启动训练并收集结果，再据此决定保留哪些改变、回退哪些方案以及下一轮继续研究什么。整个循环跨多轮和较长时间持续运行，重点展示 autonomous agent 对真实大模型 post-training workflow 的端到端接管。 | **“A-Evolve-Training 展示了 autonomous system 如何在多轮、数周的实验中完成 30B 模型的 post-training。”** |

## 改 trainer 和 researcher

这一层更接近 RSI，因为被改进的不只是 task system，而是：

> **“负责改进的系统”。**

包括 trainer、researcher、training-side harness、diagnostics 和 search mechanism。

博客认为这里最值得关注的已经不是“某一次能不能涨点”，而是 agent 能不能把偶然发现变成一条稳定的研究轨迹。

当前系统可以产生有价值的 hypothesis，却不一定可靠验证；可能找到一个更好的 checkpoint，却在下一轮将其覆盖。

因此当前真正稀缺的是 **research judgment**：

- 能否正确诊断瓶颈？
- 能否选择有信息量的实验？
- 能否判断提升是真实能力、随机波动还是 reward hacking？
- 能否保留和迁移有效结果？
- 能否在改进 task model 的同时，也改进 trainer 自身？

Rehearse 讨论的 confidence cliff 指向同一个问题：越接近能力边界，瓶颈越不是“还能不能再生成一个 idea”，而是**能不能判断哪个 idea 值得真正消耗一次训练预算**。

| Title + Link | 首次发表时间 | 核心定位 | 具体做了什么（严格依据原论文） | 博客中对这个工作的描述 |
|---|---|---|---|---|
| [**EvoTrainer: Co-Evolving LLM Policies and Training Harnesses for Autonomous Agentic Reinforcement Learning**](https://arxiv.org/abs/2606.03108) | 2026-06 | <font color="#4F6B8A">核心是认为 autonomous training 不应只等价于“搜索更好的 recipe”，因为**解释 rollout、诊断 failure、决定 intervention 的 training harness 也应持续演化**。因此 policy 与 diagnostics、backtesting procedure 和 reusable training skills 一起被反馈更新。</font> | 论文把训练 policy 和“负责训练它的 training-side harness”同时放入演化过程。Trainer 读取 rollout-level evidence，不只看最终 reward，而是通过 diagnostics 定位具体 failure mode；随后它可以修改 diagnostics、提出 training intervention，并先用历史/已有 rollout 做 backtesting，再决定是否真正投入训练。被验证有效的训练经验还会沉淀为 reusable training skills，因此跨轮积累的不只是新 policy，也包括 trainer 自己用于诊断和干预的训练能力。 | **“EvoTrainer 不只搜索训练 recipe，还让 training-side harness 与 policy 一起演化。Trainer 需要阅读 rollout-level evidence，发现具体 failure mode，修改 diagnostics，回测 intervention，并积累能够复用的训练 skill。”** |
| [**Bilevel Autoresearch: Meta-Autoresearching Itself**](https://arxiv.org/abs/2603.23420) | 2026-03 | <font color="#4F6B8A">核心是把 autoresearch 真正提升到**bilevel meta-research**：inner loop 优化 task，outer loop 读取 inner 的代码与搜索轨迹，直接生成新的 search mechanisms 来改变“以后怎么搜”。两层使用同一个 LLM，因此提升不是来自更强的 meta model，而是 search procedure 被修改。</font> | 论文把 autoresearch 拆成 inner 和 outer 两层。Inner loop 像普通 autoresearch 一样不断修改 task solution / code 并根据 evaluation 搜索更好结果；Outer loop 不直接解决下游任务，而是读取 inner-loop code、search history 和 trajectories，分析 inner search 为什么停滞或低效，然后动态生成新的 Python search mechanisms，并把它们注入 inner loop。于是外层优化的对象不是某个 task candidate，而是“内层以后应该如何搜索”。 | **“内层优化任务。外层阅读内层代码和 trajectory，寻找搜索机制中的瓶颈，再修改‘内层应该如何研究’。被改进的已经不只是 task model，而是 search mechanism。”** |
| [**From Trainee to Trainer: LLM-Designed Training Environment for RL with Multi-Agent Reasoning**](https://arxiv.org/abs/2606.17682) | 2026-06 | <font color="#4F6B8A">核心是把下一阶段 environment design 从外部人类 teacher 交给**当前正在被训练的 policy 自己**。更关键的是论文还比较训练前后的 checkpoint 作为 environment engineer 的能力，因此直接检查“trainee 变强后，是否也更会训练下一代”。</font> | 论文让当前 policy 兼任 trainee 与 environment designer：它根据自身 failure trajectories、行为摘要和环境统计，提出下一阶段训练环境/任务配置；系统用这些配置继续 RL 训练，再基于新的 failure 更新下一阶段环境。论文进一步把原始 base model 与训练后 checkpoint 都放到 environment engineer 角色上比较，检验训练是否不仅提升 task-solving policy，也提升其设计后续训练环境的能力。 | **“From Trainee to Trainer 让当前 policy 参与设计下一轮训练环境。”** |
| [**AutoTrainess: Teaching Language Models to Improve Language Models Autonomously**](https://arxiv.org/abs/2606.31551) | 2026-06 | <font color="#4F6B8A">核心观点是 autonomous post-training 不只是“给 agent 一个 shell”。论文把人类训练经验外显成 **planning、data、train、eval、logging 等 agent-computer interfaces、workflow 和约束**，研究什么样的 training harness 才能让 agent 长时间稳定完成模型训练。</font> | 论文关注“如何让语言模型真正承担训练另一个语言模型”的系统接口问题。它把模型训练拆成 planning、data preparation、training、evaluation、logging 等可调用的 agent-computer interfaces，并将人类训练经验外显为 workflow、rules 和 execution constraints，使 trainer agent 不必直接在完全裸露的 CLI / infrastructure 上工作，而可以通过结构化接口制定计划、准备数据、启动训练、读取评测并记录实验历史。 | **“AutoTrainess 则从另一个角度说明，trainer agent 的能力不仅取决于模型，也取决于它拥有什么样的 planning、data、training、evaluation 和 logging interface。”** |
| [**RSIBench-Data: Benchmarking Data-Centric Research for Recursive Self-Improvement**](https://arxiv.org/abs/2607.25886) | 2026-07 | <font color="#4F6B8A">核心是用**控制变量的方法单独测 research capability**：固定 target model、training、serving、evaluation 和预算，只允许 researcher 修改 data strategy。这样可以把“是否会根据 checkpoint feedback 做数据研究”与系统工程能力分离，并进一步观察 best attempt 能否被稳定保留到 final。</font> | 论文为了单独测“data-centric research ability”，刻意把其他变量固定：target model、training pipeline、serving、official evaluation 和资源预算都由 benchmark 提供，researcher 不能任意修改。Agent 先观察 base model 的 failures 和已有 evaluation，提出数据相关 hypothesis，设计 synthetic-data / filtering / mixture strategy；系统按固定 Train Service 训练新 checkpoint，再由独立 Eval Service 返回结果。Researcher 根据 checkpoint feedback 继续下一轮数据研究，因此测的是“分析失败 → 提数据方案 → 训练验证 → 保留/修改方案”的研究闭环，而不是一般 shell 工程能力。 | **“RSIBench-Data 测的也是 researcher scope，只是把可修改对象限制在 data。模型、训练栈、serving、正式 evaluation 和预算尽量保持固定。Agent 负责分析失败、提出 hypothesis、设计数据策略，再根据新 checkpoint 的结果继续研究。”** 博客进一步强调，agent 往往能够找到更好的中间策略，但继续搜索后 final version 经常低于中途 best version：**“它能够发现进步，却还不会稳定地管理进步。”** |
| [**RSIBench-Data 中的 Kimi K2.6 same-family experiment**](https://arxiv.org/abs/2607.25886) | 2026-07（同论文实验） | <font color="#4F6B8A">这一实验专门测试 **same-family self-improvement**：Kimi K2.6 作为 researcher 去设计如何通过 synthetic data 改进 Kimi K2.6 target。重点是看没有更强外部 researcher 时，同系列模型能否依靠自己的研究循环稳定超过初始 base。</font> | 这是 RSIBench-Data 中的 same-family self-improvement 实验：使用 Kimi K2.6 作为 researcher，同时把 Kimi K2.6 的 instruction-tuned model 作为待改进 target。Researcher 不能直接改训练栈，而是多轮分析 SWE-bench Pro 上的失败和 checkpoint feedback，修改 synthetic-data 的生成格式、内容和 pipeline，再通过固定的 LoRA SFT 得到新 checkpoint。实验用来观察“同系列模型研究如何训练自己”时，数据策略能否跨轮真正带来稳定增益。 | **“让 K26 训练 K26 的实验也呈现出类似现象：模型能够改进数据格式和合成 pipeline，却仍然很难稳定超过初始 base。”** |
| [**Rehearse: Stepping Back from the Confidence Cliff in Self-Improving Autoresearch**](https://arxiv.org/abs/2607.27687) | 2026-07 | <font color="#4F6B8A">核心是把 autoresearch 的瓶颈从“能否继续提出 idea”转向**执行前能否正确判断哪个 idea 值得花一次昂贵训练预算**。论文发现越到搜索后期，有效 modification 越少、pre-execution judgment 越不可靠，但 agent 仍保持决策意愿，从而形成 confidence cliff。</font> | 论文研究 autoresearch 中一个更细的 bottleneck：在真正花费训练/实验预算之前，agent 能否判断 proposed modification 值不值得执行。作者跟踪这种 pre-execution judgment 随迭代轮数的变化，发现早期 low-hanging fruit 较多时判断更可靠，而搜索后期有效 modification 变少后，判断准确性下降但模型信心并没有同步下降，即 confidence cliff。Rehearse 因此让 agent 先生成多个 candidate ideas、在执行前相互比较，并检索与当前 modification 相关的历史 outcome memory，再决定真正执行哪一个。 | **“在 autoresearch 的早期，明显的低垂果实很多，agent 提出的 modification 更容易有效。随着成功改进不断积累，剩余问题越来越难，有效 modification 的比例开始下降。更危险的是，agent 的判断可靠性已经下降，却仍然很有信心。”** |

# 后半部分：如何构建真正可研究的 RSI 系统

前面的六种 scope 回答的是 **“AI 被允许改什么”**。博客后半部分开始回答另一个问题：

> **如果要真正研究 RSI，应该怎样设计 benchmark、系统边界和评价方法，才能知道一次改进到底来自哪里，并验证“改进者本身是否变强”？**

博客的核心主张逐渐从 self-evolve 方法本身，转向 **RSI 的研究系统设计**：先把不同改进对象隔离并 service 化，再逐步从 scoped improvement 走向 joint improvement，最后才测试 recursive improvement。

## 现在的 benchmark 有三种 position

博客把当前 benchmark 大致分成三条路线：

| Benchmark position | 主要做法 | 博客认为的优势 | 博客指出的问题 / 局限 |
|---|---|---|---|
| **高难度 agentic benchmark** | 通过大量人工设计构造足够困难、足够长程的任务，测试 frontier agent 能否完成。博客举 FrontierXX、ALE 一类作为例子。 | 任务质量高、目标具体、失败容易分析。 | 构造成本很高，而且能力提升仍然依赖人持续生产更难的问题。 |
| **真实 AI research benchmark** | 直接使用真实研究任务，让 researcher agent 完成更完整的 AI R&D。博客举 AIRS-Bench、PostTrainBench 一类作为例子。 | 真实研究任务本身足够困难，不需要持续人工制造 puzzle；搭好训练、运行和评测基础设施后，可以持续测试新 researcher，整体更像 AI R&D platform。 | 如果 data、training、serving、evaluation 和系统操作全部开放，会把多种能力和 failure mode 混在一起，难以归因。 |
| **Service-native scoped research benchmark** | 把不同系统组件物理隔离，通过明确 service 接口调用；只开放当前要研究的对象，其他组件保持独立、稳定和可审计。RSIBench-Data 属于这一思路。 | 能把具体 research capability 从复杂系统中剥离出来，使 benchmark 的科学 claim 更清楚。 | 它不试图一次测“完整 RSI”，而是主动缩小可变对象；因此需要与其他 scoped、joint 和 end-to-end benchmark 配合。 |

博客明确更看重第三种路线的价值：

> ==**RSI 不只需要更困难的任务，也需要更好的归因。**==

如果不知道一次 improvement 来自哪里，不同工作的结果就很难积累，更难组合成真正的 recursive system。

---

## Everything as Service：RSI 的实验架构

博客提出的核心 system design 是 **Everything as Service**。

它的 claim 不是“把系统做成 API 会更方便”，而是：

> **RSI 中每一种可改进对象，都应该先成为一个边界清楚、可以独立调用、替换、记录和验证的研究单元。**

博客列出的 service 包括：

| Service | 博客中的作用 |
|---|---|
| **Model as Service** | 提供稳定的模型调用和模型版本。 |
| **Data as Service** | 管理数据生成、筛选、混合和追踪。 |
| **Train as Service** | 提供训练、优化和 checkpoint 管理能力。 |
| **Serve as Service** | 提供统一的推理接口。 |
| **Eval as Service** | 在独立环境中运行正式评测。 |
| **Environment as Service** | 提供可控制、可版本化的任务和交互环境。 |
| **Harness as Service** | 封装 prompt、tool、skill、memory 和 workflow。 |
| **Agent as Service** | 封装完整的 researcher system，并最终作为递归循环中的改进者。 |

Everything as Service 主要解决三个问题。

### 1. 归因

不同 benchmark 只开放对应的研究对象。

例如：

- 只开放 Data Service，固定 train、serve、eval，那么最终能力变化更可能来自数据研究；
- 测 Harness Service，可以在相同 model、task 和 budget 下比较不同 harness；
- 测 Environment Service，可以固定 policy training 和正式 evaluation，只研究 environment 和 curriculum。

博客的核心判断是：

> **Service 会让每个 benchmark 的 claim 更小，但更可信。**

### 2. 隔离

Train、Serve、Eval 等组件物理隔离之后：

- agent 不需要反复处理依赖、进程和基础设施；
- 正式 Eval Service 不容易被 training process 读取或修改；
- 可以减少无意义的 FLOPs 和 token 消耗；
- 可以降低 data leakage、test hacking 和环境污染。

因此 service 不只是工程抽象，也承担了 evaluation boundary 和 safety boundary 的作用。

### 3. 组合

Service 并不意味着某个模块永远固定。

同一个组件可以：

- 在当前 benchmark 中作为固定基础设施；
- 在更外层 benchmark 中重新成为可优化对象。

例如博客给出的逻辑是：

- data benchmark 中，Train Service 可以固定；
- algorithm benchmark 中，Train Service 的 recipe 和 algorithm interface 又可以成为研究对象；
- harness benchmark 中，Agent Service 可以固定；
- agent benchmark 中，model、harness、skill、memory 的组合又可以被替换和比较。

所以 Everything as Service 真正要明确的是：

- **这一轮什么可以变，什么不能变；**
- **feedback 从哪里来；**
- **谁有权决定新版本是否被接受。**

---

## Shell 与 Service：操作自由不等于研究自由

博客专门回应了一个可能的质疑：

> 把 training、evaluation 和 environment 封装成 service，会不会限制 agent 的 autonomy？

作者的回答是否定的。

博客区分了两种“自由”：

| | Raw Shell | Service |
|---|---|---|
| 提供的空间 | 大量底层操作空间 | 明确、稳定的研究接口 |
| Agent 可能花费资源的地方 | CUDA、进程、路径、checkpoint 格式、serving 等系统操作 | hypothesis、experiment、evidence、diagnosis |
| 更适合回答的问题 | **Agent 能不能把事情最终做完？** | **Agent 为什么能够把事情做得更好？** |

博客将其概括为：

> **Shell 给的是操作自由，Service 给的是研究自由。**

它并不主张取消 end-to-end benchmark。完全自主的 agent 仍然需要在真实系统中被测试，因为这样才能暴露：

- 系统操作失败；
- security 问题；
- reward hacking；
- 是否能够最终交付结果。

但如果目标是分析某一种具体 research capability，就还需要另一套 **service-native controlled benchmark**。

因此，**end-to-end 与 service-native benchmark 是互补关系，而不是替代关系。**

---

## Agent as Service：recursion 的接口

只把 Model、Train、Serve 和 Eval service 化，还不足以形成 recursive improvement。

原因是：

> 此时 researcher agent 仍然是 benchmark 外部那个固定的执行者。

系统可以测试它：

- 改 data；
- 改 harness；
- 改 environment；
- 训练 task model；

但无法统一回答：

> **这个 agent 自己有没有变成一个更好的 researcher？**

因此博客认为最终必须 service 化的对象是 **Agent 本身**。

| Service                | 封装的对象                            | 典型输入 → 输出                                              | 在 RSI 中的角色                                              |
| ---------------------- | ------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| **Model as Service**   | 一个模型/checkpoint                   | prompt/context → model output                                | 被调用的能力组件                                             |
| **Data as Service**    | 数据生成、筛选、混合                  | data request/strategy → dataset                              | 被 researcher 修改/调用的对象                                |
| **Train as Service**   | 训练过程                              | model + data + config → checkpoint                           | 把某种研究方案变成新模型                                     |
| **Eval as Service**    | 正式评测                              | candidate → score/evidence                                   | 独立提供 feedback                                            |
| **Harness as Service** | prompt、tool、skill、memory、workflow | model + task → agent execution                               | 模型外部的能力组织方式                                       |
| **Agent as Service**   | **完整 researcher / improver**        | research objective + available services + budget → hypothesis、experiment、artifact、decision、trajectory | **负责决定“下一步做什么”的主体；同时它自己也可以被版本化和改进** |

### Agent as Service 包含什么？

博客认为一个完整 researcher system 至少包括：

- model；
- system prompt；
- harness；
- skills；
- memory；
- tools；
- context policy；
- permission；
- budget。

### Agent as Service 输入什么、返回什么？

给 researcher：

- 一个 research objective；
- 一组可以调用的 services；
- 一个 resource constraint。

它应当返回：

- experimental hypothesis；
- execution plan；
- training / system artifact；
- result analysis；
- retain / rollback decision；
- 完整且可审计的 trajectory。

### 为什么 Agent as Service 对 recursion 很关键？

Service 化之后，不同 researcher 可以在同一个任务和预算下比较，也可以承担不同角色，例如：

- Agent A 提 hypothesis；
- Agent B 执行实验和训练；
- Agent C 审计 evaluation、检查 leakage、质疑结论。

更重要的是：

> **一个被改进过的 researcher 可以注册成新的 Agent Service，然后重新投入下一轮 researcher evaluation。**

下一轮不只测试它产生的 task model 是否更强，还重新测试它是否：

- 更会诊断失败；
- 更会选择实验；
- 更能避免无效训练；
- 更能识别虚假提升；
- 更能保存和迁移研究经验；
- 更能改进下一个 model；
- 更能改进下一个 researcher。

博客据此区分：

- 训练出更强 task model，但 trainer 没变强 → **automated training / model improvement**；
- 写出更好的 harness，但下一轮 agent 没有更会使用和改进 harness → **harness evolution / system improvement**；
- 新的 Agent Service 成为更强的 improver，并重新进入下一轮 → **recursion 开始闭合**。

博客用两句话概括：

> **Everything as Service 是 RSI 的实验架构。**

> **Agent as Service 是 recursion 的接口。**

---

## 为什么需要一组 RSIBench-XX？

博客认为 RSI 不是一个单一能力，因此不应该只使用一个最终总分衡量。

更合适的方向是构建一组 **scope 明确的 RSIBench-XX**。

这里真正重要的是 **XX**：它明确这一轮究竟把什么交给 agent 改进。

| Benchmark scope | 博客希望测什么 |
|---|---|
| **RSIBench-Data** | Data-centric research。 |
| **RSIBench-Harness** | Prompt、skill、tool、memory 和 workflow 的改进。 |
| **RSIBench-Train / RSIBench-Algorithm** | Training algorithm、reward 和 recipe 的研究能力。 |
| **RSIBench-Env** | Environment、task distribution 和 curriculum 的设计能力。 |
| **RSIBench-Eval** | Evaluator、rubric 和 evaluation gap 的发现，同时保持正式 evaluation 独立。 |
| **RSIBench-Agent** | 被改进后的 agent 是否成为更好的 researcher。 |
| **RSIBench-Joint** | 不再提前告诉 agent 必须改 data、harness 还是 algorithm；让它先诊断瓶颈，再决定调用和修改哪个 service。 |
| **RSIBench-Recursive** | 把新的 researcher 放回下一轮，测试它能否继续改进 researcher，以及这种能力能否跨轮累积。 |

博客并不是要求所有 benchmark 都由一个项目统一建设，也不是要求所有工作都冠以 RSIBench 名称。

作者真正主张的是需要同时存在：

- 高质量的 **single-scope benchmark**，回答清楚的科学问题；
- **end-to-end benchmark**，观察真实 autonomy 和 failure mode；
- **recursive benchmark**，测试 improver gain 是否能够累积。

整体路线可以概括为：

> **Scoped → Joint → Recursive**

也就是：

1. 先测清楚一个具体 scope 的 improvement；
2. 再让 agent 自己判断应该修改哪个 scope；
3. 最后把改进后的 researcher 本身重新投入下一轮。

---

## 下一步需要更清楚的 Claim

博客认为当前领域的一个问题，是 **self、evolve、autonomous、recursive 经常被混用**。

为了避免“只要循环多轮就叫 RSI”，作者提出五层更清楚的 claim：

| Claim | 博客中的定义 |
|---|---|
| **Task Improvement** | 同一个 agent 通过 reflection、search 或 memory，把当前任务做得更好。 |
| **Model Improvement** | Agent 生成 data、reward 或 training strategy，得到任务能力更强的 model。 |
| **System Improvement** | Agent 修改 prompt、skill、tool、memory、workflow、code 或 harness，使整个 agent system 变强。 |
| **Improver Improvement** | 被改进的是 data engineer、environment engineer、trainer 或 researcher。 |
| **Recursive Improvement** | 改进后的 improver 被重新放入下一轮，并继续提高后续 improvement capability。 |

这几层都具有价值，但博客反对因为系统运行了多轮，就把它们全部称为 recursive improvement。

因此，一个 RSI 相关工作至少应该交代清楚：

- 谁是 improver？
- 谁是被改进对象？
- 哪些组件允许修改？
- 哪些组件以 service 形式保持固定？
- feedback 来自哪里？
- 结果是否经过独立 evaluation？
- 最好版本如何保存和晋升？
- improvement 能否迁移到新 task 和新 model？
- 被改进后的系统有没有重新成为下一轮 improver？

博客认为：

> **把 claim 说小、说准，不会削弱工作；反而只有这样，不同工作才能组合成一条可信的 RSI roadmap。**

---

## RSI benchmark 不能只看最终 task score

如果研究目标是 RSI，博客认为仅报告 final task score 远远不够。

作者列出了至少还需要关注的七类量：

- **Discovery**
- **Selection**
- **Retention**
- **Transfer**
- **Efficiency**
- **Improver Gain**
- **Compounding**

博客在这一节没有逐项给出形式化定义，而是通过三个现象说明为什么需要它们：

1. **RSIBench-Data** 中，best attempt 与 final attempt 可能存在明显差距；
2. **Harness Updating Is Not Harness Benefit** 中，“产生了更新”和“真正从更新中受益”存在差距；
3. **Rehearse** 中，随着搜索深入会出现 **confidence cliff**：判断可靠性下降，但 agent 仍然高置信地继续选择 modification。

博客据此给出的核心判断是：

> **找到一次进步，与管理一条持续进步的 trajectory，是两种完全不同的能力。**

当前 agent 已经能够偶尔完成前者。

真正的 RSI 要求它稳定完成后者。

---

# 博客的最终 Position

博客最后集中反对三个容易走偏的方向。

## 误区 1：把 RSI 理解成“什么都能改”的超级 Agent

作者认为：

> **Unrestricted 不等于 recursive。**

可修改空间越大：

- improvement 越难归因；
- reward hacking surface 越大；
- 系统噪声越多。

因此“给 agent 一台机器并允许修改所有文件”本身不能证明系统更接近 RSI。

## 误区 2：把多轮 optimization 直接理解成 recursion

多轮循环只能说明：

> 同一个 improvement operator 被重复调用。

而博客对 recursion 的要求是：

> **Improvement operator 自身也被改进，并重新进入下一轮。**

所以关键不是“跑了多少轮”，而是是否形成了：

**improver → improved improver → next-round improver**

这样的依赖关系。

## 误区 3：只看最终 task score

博客认为 final score 无法回答系统究竟完成了哪一层 improvement。

- 新 model 更会解题，但没有成为更强 trainer → **Model Improvement**；
- 新 harness 提高任务表现，但没有提高下一轮 harness design 能力 → **System Improvement**；
- 只有新的 improver 自身更强，并重新进入循环，才开始进入 **Recursive Improvement**。

---

# 整篇博客的核心观点总结

这篇博客可以被压缩成以下六个核心判断。

### 1. RSI 的核心不是“循环”，而是“递归依赖”

是否 recursive，不取决于运行多少轮，而取决于：

> **被改进后的对象有没有成为下一轮更强的改进者。**

### 2. Self-Evolve 的发展可以理解为“可修改 scope 不断向外扩张”

博客沿着下面的路线组织现有工作：

> Output / Trajectory<br>
> → Data / Reward / Weights<br>
> → Prompt / Skill / Tool / Harness<br>
> → Environment / Curriculum<br>
> → AI R&D Process<br>
> → Trainer / Researcher

越往外层，系统越接近“修改负责改进的机制本身”。

### 3. 当前最关键的能力瓶颈逐渐从 generation 转向 research judgment

早期 self-evolve 更多关注：

> 能不能生成新的答案、新的数据、新的 skill、新的 modification？

而当系统逐渐接近能力边界后，更困难的问题变成：

- 应该改什么？
- 哪个 experiment 值得执行？
- improvement 是否可信？
- best version 是否应该被保留？
- 是否应该继续搜索？
- 下一次 budget 应该花在哪里？

因此，博客认为真正稀缺的是 **持续管理 improvement trajectory 的能力**。

### 4. RSI 首先是一个 research-system problem

博客并不把 RSI 简单理解成一个新的 training algorithm。

要验证 RSI，必须能够：

- 隔离不同可修改对象；
- 明确权限边界；
- 提供独立 evaluation；
- 保存和版本化 candidate；
- 进行 rollback；
- 比较不同 improver；
- 让 improved improver 重新进入下一轮。

所以：

> **Everything as Service 是 RSI 的实验架构。**

### 5. Agent 必须成为可以被版本化和重新投入循环的对象

如果 researcher 永远固定在 benchmark 外部，就只能测它如何改别人。

只有将 researcher 本身做成 **Agent as Service**：

- 可以保存；
- 可以比较；
- 可以复测；
- 可以被改进；
- 可以重新进入下一轮；

才能真正测试 **Improver Improvement → Recursive Improvement**。

所以：

> **Agent as Service 是 recursion 的接口。**

### 6. RSI 的研究路线应该从 Scoped 走向 Joint，再走向 Recursive

博客最终提出的研究路线不是一开始就做“万能 RSI agent”，而是：

> **Scoped → Joint → Recursive**

先分别测清：

- Data；
- Harness；
- Train；
- Environment；
- Eval；
- Agent；

再让 agent 自己诊断应该修改哪个部分，最后才测试：

> **新的 researcher 是否比旧 researcher 更会继续产生 successor，并且这种 improver gain 能否跨轮累积。**

---

# 一句话总结

> **这篇博客认为，Self-Evolve 的发展是在不断扩大“AI 能改什么”；真正的 RSI 则要求“负责改进的 improver 本身也被改进，并作为更强的 improver 重新进入下一轮”。为了科学地验证这一点，需要用 Everything as Service 隔离和归因不同 improvement scope，用 Agent as Service 让 researcher 本身可版本化、可复测、可重新投入循环，并沿着 Scoped → Joint → Recursive 的 benchmark 路线逐步验证。**
