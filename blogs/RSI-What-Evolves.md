---
permalink: /blogs/RSI-What-Evolves/
title: "什么在进化？——Model、Harness 与 Artifact 的三层地图"
date: 2026-08-10
layout: single
author_profile: true
---

> **《走向递归自我改进：从 Self-Evolving Agents 到 RSI》系列·上篇**<br>
> 本篇回答 **What evolves?**：自进化系统究竟在优化产物、Agent Harness，还是模型本身？<br>
> 下篇：[递归如何闭环？——从可修改范围到 Agent as Service]({{ '/blogs/RSI-Where-the-Loop-Closes/' | relative_url }})

## 写在前面：来源与致谢

这篇文章是一份基于优秀公开博客的学习笔记与交叉整理，核心概念、分类框架和案例线索主要来自以下三篇原文：

1. **Shilong Liu**：[A Taxonomy of Self-evolving Agents](https://lsl.zone/blog/2026/a-taxonomy-of-self-evolving-agents/)
2. **Lilian Weng**：[Harness Engineering for Self-Improvement](https://lilianweng.github.io/posts/2026-07-04-harness/)
3. **知乎原作者**：[自进化（Self-evolving／RSI），一篇就够了](https://zhuanlan.zhihu.com/p/2065227313973825752)

三位作者从 taxonomy、harness engineering 和案例综述等不同角度，把一个仍在快速发展的研究方向讲得非常清楚。本文以 Shilong Liu 提出的三层 taxonomy 为主线；Artifact 与跨层案例主要结合知乎文章；Harness 的设计、优化路径与挑战主要来自 Lilian Weng 的文章。我的工作主要是重新组织这些材料、对照三种表述，并补充相关论文链接与机制说明。

本文不替代原文，也不将原作者的框架和判断视为自己的原创观点。涉及具体观点时会尽量在正文中保留来源链接；如果你对某个方向感兴趣，强烈建议继续阅读三篇原文。

{::options toc_levels="2-4" /}

**目录**

* TOC
{:toc}

---

## 1. 什么是 Self-evolving？什么是 RSI？

### 1.1 分类博客为什么先讨论名称？

[分类博客](https://lsl.zone/blog/2026/a-taxonomy-of-self-evolving-agents/)不是只指出 self-evolving、self-improving、learning、adapting 等词正在混用，而是先提出三个问题：这些词是否指同一件事？如何把相关工作分成不同方向？它们与 recursive self-improvement、continual learning 和 test-time training 有什么区别？

分类博客没有逐一为所有名称下定义。严格按原文，可以确认的是：

1. **Self-evolving、self-improving、learning、adapting**：原文只把它们称为不同工作正在使用的 similar words，并提出“它们是否指同一件事”的问题，没有分别给出词典式定义。
2. **Learning 不一定表示修改模型权重**：Prompt、playbook 或 memory 的更新不改变权重，但作者认为，如果把 harness 视为 agent 的一部分，把这种 harness update 称为 learning 也没有问题。
3. **Model learning without gold answers**：这一方向的明确区别是更新 model weights。作者说，相关工作通常以 self-training、weak supervision、self-play、reinforcement learning、test-time training、online learning 或 continual learning 等名称出现；这些工作中的许多并不会自称 self-evolving agent。
4. **Self-training、self-play 与 RL**：原文进一步说明，self-training 可以从数据自身构造 pseudo ground truth；self-play 可以把另一个 player 看作 environment；如果内部或环境信号能够转成 reward，则可以用于 RL。原文没有在这里单独解释 weak supervision 这个名称。
5. **Continual learning**：也称 online learning，在一些语境中也称 lifelong learning。经典 setting 关注学习新任务时如何避免 catastrophic forgetting；一种有效方法是在学习 B 时 replay 一部分 A 的数据。作者又指出，今天 LLM 讨论中的 continual learning 往往更接近 self-evolving agent。
6. **Test-time training（TTT）**：原文把它称为一个 special case，认为它试图解决相似问题，但采用很不同的方法，而且它从不称自己为 self-evolving。一些 sequence model 可以被理解为在 inference 时进行 gradient-based update，持续更新一个 matrix。
7. **Recursive self-improvement、automated discovery、test-time adaptation**：这三个名称与 continual learning、online learning 一起出现在文章结尾的历史名称列表中。原文在这句话里只说 self-evolving idea 曾以这些不同名称出现，并没有在该处分别解释 automated discovery 或 test-time adaptation 的机制，因此本报告也不额外补定义。

因此，按这篇分类博客自己的宽泛口径，**RSI 就是 self-evolving / self-improving 这套思想的一种名称**

作者因此不主张继续围绕名称争论。原文用下面这段话总结名称变化，并引出真正需要回答的三个分类问题：

> **The idea of self-evolving agents has appeared many times in the past under different names**: recursive self-improvement, continual learning, online learning, automated discovery, and test-time adaptation. The names changed because the available systems changed. Today we have large models, tool-using agents, parallel execution, richer environments, and more useful verification signals.
>
> Instead of arguing about names, I find it more useful to ask three simple things.
>
> What evolves? What feedback drives it? Where does the loop close?

也就是：什么对象发生变化、什么反馈驱动更新，以及反馈循环最终闭合在哪里。

### 1.2 分类博客如何建立三层 Taxonomy？

为了回答“what evolves”，分类博客先区分一个 agent 系统中的三个基本对象：

$$
\text{Agent}=\text{Model}+\text{Harness}
$$

- **Model** 是接收 prompt、产生响应的模型。
- **Harness** 包括 loop、memory、tool 等围绕模型的组件，它把 model 变成 agent。
- **Artifact** 是 agent 产生的结果，例如 kernel 算法、论文、科研发现或机器人策略。

因此，现有 self-evolving systems 可以按照“什么东西在变”分为三层：

1. **Artifact iterative optimization**：反复改进 agent 的输出。
2. **Agent harness self-improvement**：改进 prompt、memory、tool、skill、workflow 等 agent 组件。
3. **Model learning without gold answers**：在没有标准答案的情况下更新模型权重。

![Models, harness, and artifacts]({{ '/images/rsi/models-harness-artifacts.png' | relative_url }})

这套 taxonomy 的逻辑因此是：名称本身不能清楚区分工作 → 先确定系统由 Model、Harness、Artifact 三个对象构成 → 再按照直接发生变化的对象，把现有 self-evolving systems 分成三层。除了“什么在变”，还要继续说明系统由什么 feedback 驱动，以及 loop 最终闭合在哪里。

### 1.3 Weng 博客中的 RSI

[Weng 的博客](https://lilianweng.github.io/posts/2026-07-04-harness/)把 recursive self-improvement（RSI）的概念追溯到 I. J. Good（1965）的 ultraintelligent machine: a system that can surpass humans in all intellectual activities and design better machines to improve itself。[Yudkowsky(2008) ](https://www.lesswrong.com/posts/JBadX7rwdcRFzGuju/recursive-self-improvement)明确使用RSI这个词来描述一个特定的反馈循环：AI 使用当前智能，去改进产生其智能的 cognitive machinery。

在现代 AI 中，这个循环可以表现为：

- 模型直接改写或更新自己的权重；
- 模型改进 training pipeline；
- 模型改进 deployment system，进而产生在实际任务上表现更好的后继模型。

Weng 特别提出 deployment system，是因为 raw model 与真实世界 context 之间的层非常重要，而 harness 正是 deployment system 的重要组成部分。这篇博客的重点是 **harness engineering 如何贡献于 RSI**。

### 1.4 知乎博客中的两种表述口径

[知乎博客原文](https://zhuanlan.zhihu.com/p/2065227313973825752)在文章前部和结尾采用了宽窄两种表述，这两部分都需要保留，不能只选其中一种：

- follow分类博客，认为三个自进化方向都算RSI；认为三层边界正在模糊并相互反哺：Harness 经验可以变成训练数据和训练基础设施；更强的 model 与 harness 产生更好的 artifact；artifact 又可以成为 harness 的新工具；三个方向最终形成闭环。我们把"改脚手架 → 训练 → 完成任务"这整个过程包成一个 loop，让它自己不断循环下去—这就出现了 RSI。
- 在结尾，文章又给出更严格的区分：RIS是"变好的能力"本身也在变好，一圈套一圈地往前滚；当前大多数案例仍属于“变好”的范畴，真正具有递归性的案例较少。

### 1.5 三篇博客各自承担什么角色？

| 博客 | 主要回答的问题 | 在本报告中的作用 |
|---|---|---|
| [A Taxonomy of Self-evolving Agents](https://lsl.zone/blog/2026/a-taxonomy-of-self-evolving-agents/) | 相关名称是什么关系？如何对自进化分类？什么对象在进化？应该关注什么问题？ | 解释术语随系统变化的关系，并提供 Artifact、Harness、Model 三层分类 |
| [Harness Engineering for Self-Improvement](https://lilianweng.github.io/posts/2026-07-04-harness/) | Harness 如何设计、如何成为优化对象并贡献于 RSI？ | 提供 Harness 的设计模式、优化路径、案例和挑战 |
| [自进化（Self-evolving／RSI），一篇就够了](https://zhuanlan.zhihu.com/p/2065227313973825752) | 基于分类博客的三分类，介绍三种分类下有哪些实际案例？它们如何相互反哺并走向 RSI？ | 补充 Autoresearch、AlphaEvolve、Hermes、RHI、AIDE²、SIA 等案例、反面评估和整体闭环 |

## 2. 三层 Self-evolving Taxonomy 总览

| 层级 | 直接优化对象 | 模型权重是否更新 | 典型反馈—更新闭环 | 博客中的例子 |
|---|---|---:|---|---|
| Artifact iterative optimization | Agent 产生的代码、算法、论文、策略等 | 否 | 测试、验证集或自动 evaluator 评价当前产出 → 生成并选择更好的 artifact → 未达到标准则继续迭代 | [FARS](https://arxiv.org/abs/2606.31651)、[Autoresearch](https://github.com/karpathy/autoresearch)、[AlphaEvolve](https://arxiv.org/abs/2506.13131) |
| Agent harness self-improvement | Prompt、memory、tool、skill、workflow、harness code | 否 | 从 rollout、失败轨迹和 benchmark 中提炼问题 → 提出 harness 修改 → 用 held-in / held-out 回归测试验证 → 接受、合并或回退 | [ACE](https://arxiv.org/abs/2510.04618)、[MCE](https://arxiv.org/abs/2601.21557)、[Meta-Harness](https://arxiv.org/abs/2603.28052)、[ADAS](https://arxiv.org/abs/2408.08435)、[AFlow](https://arxiv.org/abs/2410.10762)、[STOP](https://arxiv.org/abs/2310.02304)、[Self-Harness](https://arxiv.org/abs/2606.09498)、[AHE](https://arxiv.org/abs/2604.25850)、[DGM](https://arxiv.org/abs/2505.22954)、[RHI](https://arxiv.org/abs/2607.15524)、[AIDE²](https://www.weco.ai/blog/first-evidence-of-recursive-self-improvement) |
| Model learning without gold answers | 模型参数 | 是 | 从 pseudo label、内部信号、self-play 或环境弱信号获得监督或 reward → 通过 SFT、RL 或 test-time update 更新模型 | [Self-training](https://arxiv.org/abs/2202.12040)、[TTRL](https://arxiv.org/abs/2504.16084)、[SPIN](https://arxiv.org/abs/2401.01335)、[Absolute Zero](https://arxiv.org/abs/2505.03335)、[TTT](https://test-time-training.github.io/) |

- 这三层的主要差别在于优化对象，而不是具体使用哪一种优化算法。
- 这三种彼此未必是独立的，也可以共同优化。

进化的经典流程：做题 -> 测试 -> 分析失败/成功原因 -> 反馈 -> 优化

> ==**本节人话summary**==: 从宽泛的意义上，只要模型能让自己最后的产出变好（通过修改产物本身，harness，模型参数）都可以算RSI。但严格意义上，只有让“变好”的这个机制也变好了，才算RSI。
>
> - 比如反复修改文章，文章越来越好这不算RSI。优化文章的人本身从改文章中学到了知识，以后更会改文章了，导致 "改文章" -> “文章质量提高” -> "人更会改了" -> “文章更好了” -> "人更会改了"这个循环真正能转起来，才是严格意义上的RSI
> - 上述三个类别无论是从哪个角度去优化，最终都是希望我们能得到更加高质量的输出。上述三分类只是说明，可以从哪些角度来优化，使得产物更好。我认为真正要实现RSI未必需要上面三者互相能迭代优化，三者互相促进只是RSI的一种比较现实的实现手段。比如如果模型够牛，可以固定harness，只给模型提供必要的访问环境的接口，模型或许可以通过产物和模型参数的优化循环来实现RSI。

---

## 3. Artifact Iterative Optimization

### 3.1 基本定义

[分类博客](https://lsl.zone/blog/2026/a-taxonomy-of-self-evolving-agents/)把 Artifact iterative optimization 定义为：在不改变模型参数和 harness 的情况下，通过循环获得更好的输出。

一个常见范式是：人给定目标、背景知识、初步方案和评估标准，agent 不断寻找可以改进的地方，产生新结果，并检查是否达到标准；如果没有，就继续循环。Codex、Claude Code 等工具都具有相似的工作模式。

![Artifact iterative optimization]({{ '/images/rsi/artifact-iterative-optimization.png' | relative_url }})

这个想法本身并不新，只不过相比于之前的研究，现在的LLM，尤其是 coding model，使循环变得更加灵活：

- 以前通常由人设计 operator 或 action，再围绕这些算子搜索或者提优化策略；现在模型既可以充当 operator，提出候选方案，也可以充当 optimizer，检查已有结果并决定下一步搜索方向。因此，搜索空间更大，启发式搜索器也更强。
- LLM 的长程任务能力增强后，“执行—验证—改正”循环可以运行更久，并减少人工介入。

[FARS](https://arxiv.org/abs/2606.31651) 也是一个经典的例子：系统运行 417 小时，产生了 166 篇完全由 AI 生成的论文。这里被持续优化的是论文等 artifact，而不是 agent 自身。

> 我的一个感觉：优化问题很多时候就是搜索问题。我们要把问题定义清楚，formulate好，把他**变成一个搜索问题**，不断地去搜索各种可能的解。从搜索问题的角度来说，能够搜索的空间越大，搜索越快，最后性能可能就越好。从Weng的博客中可以感知到，由于大部分训练的样本都是正确的，现在的模型不太擅长保留错误的样本。而**错误的样本**对搜索其实很关键，他的作用是否定一些路径，**缩小搜索空间**，从而更快达到final solution

### 3.2 [Autoresearch](https://github.com/karpathy/autoresearch)：优化训练代码

[知乎博客](https://zhuanlan.zhihu.com/p/2065227313973825752)介绍了 Karpathy 的 [Autoresearch](https://github.com/karpathy/autoresearch)：agent 可以整夜自动修改 `train.py`，迭代模型架构、超参数和优化器等内容，再使用客观的验证集指标进行评分。具体设置是：agent 每次固定训练 5 分钟，以 validation bits-per-byte 作为客观指标，改进就保留、没有改进就丢弃。博客还引用 Karpathy 展示的一次约两天实验：约 700 次自主改动中有约 20 次被保留，把训练到 GPT-2 水平所需时间从 2.02 小时缩短到 1.80 小时。

### 3.3 [AlphaEvolve](https://arxiv.org/abs/2506.13131)：优化基础设施算法

[知乎博客](https://zhuanlan.zhihu.com/p/2065227313973825752)的另一个例子是 Google DeepMind 的 [AlphaEvolve](https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/)：Gemini 生成候选代码，自动 evaluator 打分，进化算法保留表现较好的候选，再继续产生修改，从而获得更好的算法。文章近一步指出，成果可以反哺训练：它报告 AlphaEvolve 曾让 Gemini 使用的矩阵乘法核心提速 23%、FlashAttention 提速 32.5%，这些基础设施改进又被用于 Gemini 训练。正因为 artifact 的改进重新进入模型训练流程，文章说 AlphaEvolve 也因此常被当成 RSI 已经在生产环境里悄悄发生的例证。

[Weng 博客的 Evolutionary Search 一节](https://lilianweng.github.io/posts/2026-07-04-harness/#evolutionary-search)补充了 AlphaEvolve 的实现细节：

- prompt 中包含 parent program、执行结果、指令和部分 meta information；
- coding agent 可以访问完整 repository，但可修改区域由 `EVOLVE-BLOCK` 显式标记；
- meta-prompt 可以与 instruction 和 context 一起演化。

Weng明确表示: AlphaEvolve 等方法主要关注 solution improvement

---

## 4. Agent Harness Self-improvement

### 4.1 为什么优化 Harness？

分类博客给出的动机是：模型训练成本很高，因此一个自然问题是，能否在不更新模型权重的情况下，让已经部署的 agent 继续变好。

[Weng 的博客](https://lilianweng.github.io/posts/2026-07-04-harness/)对 harness 的定义更完整：它是围绕 base model 的系统，负责组织执行，并决定模型如何思考和规划、如何调用工具和行动、如何管理 context、如何保存 artifact，以及如何评估结果。Harness engineering 已经不只是 prompt template，而更接近 runtime 和软件系统设计。

这两篇博客的关注点不同：分类博客主要回答“Agent Harness Self-improvement 可以分成哪些方向”，Weng 则从工程角度连续讨论“Harness 如何设计、它与模型核心能力是什么关系，以及 Harness 本身如何成为优化对象”。因此，下面先完整沿着 Weng 博客的顺序展开，再回到分类博客的 prompt / memory、tool / skill 和 multi-agent 视角。

> 个人理解目前大家倾向于走这条路是因为下列两点
>
> - 优化harness带来其实就像软件工程，本身有很多优点，核心有几个：可组合，可追溯，可回滚，可解释。【这里可以加上deepseek harness的设计思路来说例子】
> - 这个路子可能能够最快拿到收益，因此模型本身已经很强了，想要根据自己的feedback再去提升可能收益没那么大，但是harness本身是一个系统，比较复杂，且刚刚发展起来，可以优化的地方还有很多。

### 4.2 Weng：[Harness 的三个基础设计模式](https://lilianweng.github.io/posts/2026-07-04-harness/#harness-design-patterns)

![Harness design patterns]({{ '/images/rsi/harness-design-patterns.png' | relative_url }})

#### Pattern 1：Workflow Automation

关键是定义一个模型可以持续 operate、test、iterate 的 workflow。典型循环是：

```text
Plan → Execute → Observe/Test → Improve → Execute again
```

模型需要在 agent runtime 中分析自己的轨迹和失败，而不是只依赖一个静态 prompt；任务规格或执行偏好不清楚时，也可以主动询问用户。Weng 将 Karpathy 的 Autoresearch 作为这种 workflow 的清晰案例。

#### Pattern 2：File System as Persistent Memory

长程任务中的实验日志、代码 diff、论文摘要、错误轨迹和历史 rollout 往往远超 context window。Harness 不应把全部状态塞进 prompt，而应把 durable state 保存在文件中。**文件系统提供了一种对复杂状态保持简单控制的方式。**

#### Pattern 3：Sub-agent and Backend Jobs

Harness **可以启动多个 sub-agent** 并行探索假设、运行实验或执行隔离子任务，同时监控后台任务。主 agent 需要一个轻量的 process manager 来启动任务、检查日志、取消失败运行并合并结果。

**并行过程必须显式、可检查**。Sub-agent 的结果如果只存在于临时聊天上下文中，很快会变得不可见；保存为文件、日志和状态记录后，模型才能在中断后恢复，并分析自己的执行历史。

| Pattern | 主要解决的问题 | 核心机制 |
|---|---|---|
| Workflow Automation | Agent 按什么过程持续完成任务 | Plan–Execute–Test–Improve 循环 |
| File System as Persistent Memory | 长期状态和中间产物保存在哪里 | 将 durable state 存入文件 |
| Sub-agent and Backend Jobs | 如何并行执行和管理多个子任务 | Sub-agent、后台任务和 process manager |

Weng 随后用 coding agent harness 说明这三种 pattern 如何落到实际系统中。主流 coding agent 通常围绕一个能够反复调用工具、读取结果并继续生成的 loop 工作，常见接口包括：

| Group | Tool definitions |
|---|---|
| File system | 文件发现：`glob`、`grep`、`ls`；文件读取：`read`、`read_many`；文件修改：`write`、`edit`、`multi_edit`、`apply_patch` |
| Shell execution | `bash`、`PowerShell` |
| IO | `lsp`，以及 `git_status`、`git_diff`、`git_commit` 等 Git 工具 |
| External context | MCP tools、Skills |
| Web search | `web_search`、`web_fetch`、browser tools |
| Artifacts | 读取文档和图片，生成 HTML、图片等 artifact |
| Backend processes | `CronCreate`、`CronDelete`、`CronList` 等后台任务接口 |
| Agent delegation | `spawn_agent`、`resume_agent`、`wait_agent`、`list_agents`、`close_agent`、`interrupt_agent` 等 |

这个例子不是另一种 self-improvement 分类，而是说明 Harness 如何为模型提供与 repository、外部 context、后台进程和其他 agent 交互的稳定接口。

### 4.3 Weng：[Harness Layer vs Core Intelligence?](https://lilianweng.github.io/posts/2026-07-04-harness/#harness-layer-vs-core-intelligence)

在介绍三个 design patterns 后，Weng 紧接着讨论 Harness 在 RSI 中的定位，以及 Harness layer 与 model core intelligence 的关系。

==**Harness 应当刻意保持简单和通用，以支持泛化。**==她把 harness 类比为操作系统：==**内部可以封装复杂逻辑，但对模型暴露的 interface 应保持简单**==；config、tool interface 和其他 protocol 也可能逐渐标准化。Harness 的价值不是不断堆叠手工规则，而是提供少量、通用、可持续的机制，以及模型连接外部 context、tool 和真实环境所需的接口。

Weng 认为，目前很难预测未来 RSI 会在多大程度上依赖 harness engineering，但近期路径不太可能从模型直接重写自身权重开始。她提出一条更现实的路径：

1. Harness engineering 走向 **meta-methodology**：不只改进答案，而是改进产生更好答案的机制；harness 本身成为优化对象，启发式规则减少，更通用的机制增加。这里叫meta是因为优化的角度在答案上，相比于直接去优化答案，优化harness是更进一步
2. 成熟 harness 支持用于模型自我改进的 auto-research loop；更智能的模型又能避免 harness 被过度设计，使系统保持可持续。

最终，许多 harness 改进可能被 **internalized** 到 model core behavior 中，但模型与外部 context 和 tool 的 interface 仍应保留。Weng 用 [prompt engineering](https://lilianweng.github.io/posts/2023-03-15-prompt-engineering/) 类比这一变化：随着 instruction tuning 和模型推理能力增强，人工 prompt tricks 逐渐不再居于核心位置，但指定目标、约束、context 和 evaluation 的需要并没有消失。

因此，这里需要同时保留三个判断：

1. **Harness 是近期 RSI 的现实入口**：先优化产生更好答案和支持 auto-research 的机制，而不是等待模型直接重写权重。
2. **Harness 应保持简单、通用**：它可以在内部封装复杂逻辑，但不应依赖越来越多的 heuristic rules，更不应因为模型能力不足而无限堆叠补丁。
3. **Harness 与模型能力会共同演化**：更好的 harness 支持 model self-improvement；更强的 model 又会把部分 harness 能力内化，并减少 overengineering，但外部 context 和 tool interface 仍然必要。

> 我的理解：这个 Prompt Engineering 的类比很准确。希望不要过度设计 harness，而是把它当作模型和环境交流的接口。从进化角度看，更好的 harness 有助于支持 model evolution。现在大家可能还在把harness变得很复杂，这是因为harness变复杂能在模型不动的情况下，让system做更多的事情，拿到更多的反馈，从而可以对system进行更新。但是把harness复杂化应该不是未来的道路，model 进化后，许多原本需要 harness 显式完成的事情可以由模型自己完成，因此 harness 反而会趋向更简单。需要保留的，是与外部 context 和 tool 交互的接口。

### 4.4 Weng：[Harness Optimization](https://lilianweng.github.io/posts/2026-07-04-harness/#harness-optimization) 应该从哪些方向进行？

Weng 用下面的顺序概括 harness 中优化对象的扩展：

```text
instruction prompt → structured context → workflow → harness code → optimizer code
```

随着模型变强，优化目标从局部、人工规则较多的对象，走向更复杂的目标和更通用的方法。这里的 **optimizer code** 容易产生层级误解：它指的是相对于 downstream solution 而言的 improver / optimizer，例如 STOP 中负责把 solution 改得更好的程序。把它映射到 Agent 系统时，这个 improver 的作用类似 Harness。因此，优化 optimizer code 仍然是在优化 Harness 或 scaffolding，而不是进一步优化“搜索 Harness 的优化算法”。

这一节主要介绍harness从什么模块去优化，从局部的模块比如context和workflow，到优化完整的harness，到优化用来优化harness的算法

#### 4.4.1 Context Engineering：ACE、MCE 与 Meta-Harness

[**ACE（Agentic Context Engineering）**](https://arxiv.org/abs/2510.04618)不把 context 当作不断增长的完整 prompt，而是维护一个由 `(identifier, description)` 条目构成的 evolving playbook：

1. Generator 参考 playbook 生成任务轨迹；
2. Reflector 从成功和失败轨迹中提炼经验；
3. Curator 用增量、结构化条目更新 playbook。

Curator 不反复重写完整 prompt，而是生成 `(identifier, description)` 条目，再用确定性逻辑合并到 playbook 中，以减少两类信息损失：

- **Context collapse**：在反复重写 context 的过程中，细节随迭代逐渐丢失，是多轮重写后的累计结果。
- **Brevity bias**：在单次整理中，为了得到更简短的摘要而丢弃有价值的领域洞见。

不过，**ACE 的更新规则和角色分工仍由人预先设计**。即使具体写入什么经验来自 rollout，如何更新 context、采用什么结构、由 Generator、Reflector、Curator 中的哪些角色完成更新，仍然是人工预设的机制。

![ACE]({{ '/images/rsi/ace-overview.png' | relative_url }})

![ACE 中的 structured playbook]({{ '/images/rsi/ace-structured-playbook.png' | relative_url }})

[**MCE（Meta Context Engineering）**](https://arxiv.org/abs/2601.21557)进一步把 mechanism 与 artifact content 分开：

- mechanism：如何构造和管理 context，在 meta level 进行 skill evolution，这是上层规则；
- artifact content：实际得到的 context，在 base level 进行 context optimization。

> 便于理解的例子：mechanism 可以规定“维护一个 playbook，并由三个组件负责生成、反思和更新”；artifact content 则是按这套机制实际产生的 context。Mechanism 固定，并不意味着每次产生的 artifact content 固定。

一个 skill 会定义一套 context function；context function 实际执行并决定怎样生成 context。也就是说，skill 和 context function 都需要在双层循环中搜索和更新。

![MCE 中 mechanism 与 artifact content 的关系]({{ '/images/rsi/mce-mechanism-artifact.png' | relative_url }})

它采用双层优化：内层在给定 skill 的情况下，根据训练数据寻找较好的 context function；外层根据验证集表现寻找较好的 skill。Skill database 保存历史 skill、context function 和评估分数，meta-level agent 参考历史产生新 skill，base-level agent 再在其指导下从 rollout feedback 中学习 context function。

> 便于理解的例子：skill 可以规定“对失败案例聚类、总结高频错误规则、保存代表性样例、按输入类型检索，并在验证集不再提升时停止扩充”；context function 则是根据这些要求实际写出的 pipeline、code 和判断规则。也就是说，$c$ 是 $s$ 的产物：外层优化 $s$，内层优化由 $s$ 产生的 $c$。

![MCE 的双层优化]({{ '/images/rsi/mce-bilevel-optimization.png' | relative_url }})

![MCE]({{ '/images/rsi/mce-overview.png' | relative_url }})

实现上，一个 context function 被实例化为专用目录中的一组文件，其中既有静态组件（如 `skill.md`），也有动态组件（context 和 data rollouts）。Meta level 和 base level 都运行在 agentic coding environment 中，并使用 `Read`、`Write`、`Edit`、`Bash`、`Glob`、`Grep`、`TodoWrite` 等标准工具。

**这里仍要保留一个边界：MCE 将“如何管理 context”也变成了可优化对象，但“外层优化 skill、内层优化 context”这一双层总体框架仍然由人设计。**

[**Meta-Harness**](https://arxiv.org/abs/2603.28052) 将优化对象进一步扩展为决定信息如何存储、检索和呈现的 harness code。正如名称中的 “Meta” 所表示的，**it is a harness for optimizing harnesses.** 它的关键不只是“再生成一个 prompt”，而是把完整 harness 变成 coding agent 可以搜索的 executable object：

1. 用于提出新 harness 的 proposer 本身是一个 coding agent。
2. 过去候选的完整 execution history 保存在文件系统中；proposer 使用 `grep`、`cat` 等命令按需查看，而不是把所有历史一次塞进 prompt。
3. 每个候选 harness 都是文件系统中的一个目录，其中包含自己的 source code、score、rollout trajectory 和 state update。
4. Meta-Harness 迭代地产生新候选，只有达到要求的候选才会保留，最终形成位于 Pareto frontier 上的一组 harness candidates。

> 与 MCE 的自然语言 skill 相比，Meta-Harness 不再把候选对象限制为 Skill，而是让 coding agent 直接搜索和修改 **Harness Code**。

Weng 对这一工作的总结是：一旦 harness design 被转化为可执行搜索空间，强大的 coding agent 就能探索人类工程师使用的同一类设计空间。

#### 4.4.2 Workflow Design：AutoData、ADAS 与 AFlow

Workflow 可以由领域专家手工设计，也可以被视为搜索问题。

[**AutoData**](https://arxiv.org/abs/2606.25996) 把 agent 设计成生成训练和评估数据的数据科学家，由主 agent 协调四个角色：

- Challenger：提出问题；
- Weak Solver：较弱的求解器；
- Strong Solver：较强的求解器；
- Verifier / Judge：验证答案并判断结果。

目标是产生难度“恰到好处”的问题，即 strong solver 能够解决、weak solver 无法解决。Challenger prompt 根据 solver 和 verifier 的反馈迭代更新。Weng 同时指出其限制：合成任务用于 fine-tune weak solver，却不用于改进 strong solver；如果循环不能继续提高 strong model，它更像在生成的 prompt distribution 上进行间接蒸馏，RSI 的意味较弱。

![AutoData]({{ '/images/rsi/autodata.png' | relative_url }})

[**ADAS（Automated Design of Agentic Systems）**](https://arxiv.org/abs/2408.08435)把 agent design 本身表示成优化问题，也就是把“agent 应该以什么 workflow 工作”作为被搜索的对象：

1. 建立包含 CoT、Self-Refine 等简单 agent 的 workflow archive；
2. Meta-Agent 参考 archive，先提出高层设计，再用代码实现新 agent；
3. 候选程序经历两轮 Self-Refine，并检查新颖性；
4. 评估新 agent，将表现较好的候选加入 archive；
5. 重复直到达到最大迭代次数。

![ADAS]({{ '/images/rsi/adas.png' | relative_url }})

[**AFlow**](https://arxiv.org/abs/2410.10762) 把 agent workflow 表示成图：节点是调用 LLM 的 action，边是在代码中实现的逻辑关系和控制流。它不是让模型一次写出最终 workflow，而是使用 MCTS 在 workflow tree 中逐步搜索：

1. 用模板初始化起点 workflow $W_0$，作为搜索树的根节点。
2. 在已有 workflow 中进行选择，兼顾当前 score 与 uniform exploration。
3. 把被选 workflow 的 evaluation performance 提供给 LLM，让 LLM 生成一个修改后的 workflow。
4. 执行并评估新 workflow。
5. 如果新方案在给定预算内取得改进，就把它加入搜索树。
6. 重复选择、扩展和评估，直到 top-$k$ workflow 的平均分不再提升，或者搜索预算耗尽。

因此，AFlow 的优化对象是整张 workflow graph；MCTS 负责“搜索哪条分支”，LLM 负责“如何修改被选中的 workflow”。Weng 还提到，AFlow 在 QA、code 和 math tasks 上相对手工 workflow 与 ADAS 获得了不错的改进。

#### 4.4.3 Self-improving Harness：STOP、Self-Harness 与 AHE

Context engineering 和 workflow design 都只覆盖 harness 的一部分。Weng 认为，完整 harness optimization 还需要搜索 context-management logic、workflow、permission 和其他 harness components；代码是表达这些系统的通用语言。

[**STOP（Self-Taught Optimizer）**](https://arxiv.org/abs/2310.02304)是较早研究 recursive scaffolding improvement 的工作。先区分两个对象：solution $s$ 是要解决的具体答案，improver $I$ 是“如何把答案改得更好”的程序。Seed improver 接收 initial solution、utility function 和 black-box language model，输出 improved solution：
$$
s' = I(u,s;M)
$$

STOP 的目标不是直接优化某一个 $s$，而是让 $I$ 在一组 downstream tasks 上都更会改答案。为此，它把一个 improver 在任务集合上的平均 utility 定义为 **meta-utility**，再让上一轮 improver 根据这个 meta-utility 改写自己，得到下一轮 improver。也就是说，外层被递归更新的是相对于 solution 的“改进方法”本身。

> 便于理解的类比：Harness 同样是拿到一个 model 和 initial solution，再通过既定流程产生更好的 solution；optimizer 的作用与 harness 类似，STOP 进一步优化的正是这套“如何改进 solution”的流程。

对应关系可以写成：solution $s$ 类似被 Agent 改进的 artifact，而 improver $I$ 类似组织模型如何改进该 artifact 的 Harness。STOP 优化 $I$，因此它是 Harness / scaffolding self-improvement 的类比；它没有再引入一个被自我改进的“Harness optimizer”。

实验中的 improved improver 自行发现了 genetic algorithm、分解后逐部分改进、multi-armed prompt bandit、simulated annealing、改变 temperature、beam/tree search 等策略。不过，使用 GPT-4 时平均 downstream performance 能够跨轮提高，使用 GPT-3.5、Mixtral 等较弱模型时反而下降。这说明仅有递归结构不够，base model 必须有足够能力去改进机制。

[**Self-Harness**](https://arxiv.org/abs/2606.09498) 使用 propose–evaluate–accept loop，但候选修改不会直接进入 active harness，而要经过三个阶段：

1. **Weakness mining**：用当前 harness $h_t$ 执行任务并收集完整 trajectory，再把失败聚类成 verifier-grounded failure patterns。相同的表层错误（如 timeout 或 missing artifact）可能来自不同机制，因此 failure record 不只保存 verifier 的最终原因，还要保存相关 agent behavior 的 causal status，以及 trajectory 暴露出的抽象 agent mechanism。
2. **Harness proposal**：同一个模型在当前 $h_t$ 下担任 proposer，根据 failure patterns 提出 bounded edits。它看到的 proposal context 包括：当前 harness 的 editable surfaces、verifier-grounded failure patterns、需要保留的 passing behaviors，以及此前尝试过的修改摘要。修改优先针对反复出现、可以通过窄改动解决的错误，而且候选之间应保持差异和多样性。
3. **Proposal validation**：候选修改分别在 held-in $D_\text{in}$ 和 held-out $D_\text{out}$ 上做 regression test。Held-in 检查原 weakness 是否得到解决，held-out 检查是否引入其他未知问题；只有两边都没有 regression 的候选才会被接受并合并成 $h_{t+1}$。

被拒绝的修改不会改变 active harness，但会被记录下来；下一轮 proposer 也能看到此前尝试的修改摘要。

Weng 对此提出安全担忧：如果程序可以修改 OS，抽象边界会被打破。因此可编辑范围需要严格设计，permission control 和 security layer 应位于自我修改循环之外，reward hacking 风险也仍然存在，例如系统可能只是让任务运行得更久，或者试图修改 verifier，而不是真正改进 harness。

![Self-Harness]({{ '/images/rsi/self-harness.png' | relative_url }})

[**AHE（Agentic Harness Engineering）**](https://arxiv.org/abs/2604.25850)认为 harness evolution 的主要瓶颈是 **observability**：rollout 失败时，系统不仅要看到“失败了”，还必须知道哪个 harness component 负责；每次 edit 也必须能够追溯到证据。它建立三个支柱：

- **Component observability**：每个可编辑 harness component 都在文件系统中显式表示，使 action space 可见、可追踪。AHE 将 harness 拆成七类组件：system prompt、tool description、tool implementation、middleware、skill、sub-agent configuration 和 long-term memory。每个 failure pattern 被映射到其中一个组件，从而让修改更有针对性。
- **Experience observability**：每个 harness 产生多条 raw trajectories，每条轨迹单独存成文件。一个 Agent Debugger 先为每项任务生成 success/failure 的 root-cause report，再把这些 per-task reports 汇总成 benchmark overview；如果摘要不够，原始 trajectory 仍可以按需访问。这种分层读取比把所有轨迹一次放进 context 更节省 token。
- **Decision observability**：Evolve Agent 读取 repository 和上述 evidence，决定修改哪个组件，并同时输出 edit 与 reasoning。每次 edit 都是一条可以在下一轮检验的、文件级的 falsifiable claim。

AHE 还设置两类约束。第一，只允许修改 harness workspace；runs directory、tracer、verifier 和 LLM configuration 保持 read-only，从而阻止关闭 verifier、替换 model、提高 reasoning budget 等 reward hacking。第二，每次修改都要附带 evidence-driven manifesto，记录失败证据名称、推断的 root cause、targeted fix、expected fixes 和 at-risk regressions。

Weng 还转述了其结果：在 Terminal-Bench-2 上，除 Hard tier 外，AHE 优于 OpenCode、Terminus-2、Codex 等人工设计 harness，也优于 ACE、TF-GRPO 等若干 self-evolve baselines；同一个 frozen harness 不再继续演化时还能迁移到 SWE-bench Verified。作者据此认为，它编码的是可迁移的 engineering experience，而不只是针对单一 benchmark 的优化。

### 4.5 Weng：Harness-updating 与 Harness-benefit

[Weng 介绍的 Lin 等（2026）](https://arxiv.org/abs/2605.30621)把模型与 harness evolution 的关系拆成两个维度：

- **Harness-updating capability**：模型能否提出有价值的 harness 修改。
- **Harness-benefit capability**：模型能否正确、及时地使用更新后的 harness，从而改善任务表现。

实验中，从较小模型到 Claude Opus 4.6，不同能力模型的 harness-updating 较为接近；Weng 特别提到，9B proposer/evolver 写出的 skill 在流程结构上可以与 Opus 相似。这说明“提出一个像样的 harness 修改”未必随核心模型能力同步增长。

但是 harness-benefit 呈非单调关系，中等模型获益最多。真正利用 harness 要求模型能够在正确时间调用 skill/tool，并保持较好的 long-horizon instruction following：较弱模型可能加载失败，或者加载后执行错误；最强模型则可能已经接近任务性能上限。因此，“谁能提出修改”和“谁能从修改中获益”必须分开评估。

![Harness updating and benefit]({{ '/images/rsi/harness-updating-benefit.png' | relative_url }})

### 4.6 Weng：Evolutionary Search 与 DGM

Weng 把 evolutionary search 放在 Harness Optimization 下单独介绍。它维护一个 solution population，通过 mutation 产生候选，并根据 fitness 保留较好的方案。它适合搜索空间很大或形状不规则、难以直接用梯度优化但候选容易评价的情况，因此 harness search 与它较为匹配。

Evolutionary search 可以优化不同对象：

- [Promptbreeder](https://arxiv.org/abs/2309.16797) 优化 task prompt，并让用于修改 task prompt 的 mutation prompt 一起演化；
- [GEPA](https://arxiv.org/abs/2507.19457) 把自然语言 reflection 与 evolutionary search 结合，用试错轨迹提出 prompt 更新；
- [AlphaEvolve](https://arxiv.org/abs/2506.13131) 主要改进 solution program；
- [**DGM（Darwin Gödel Machine）**](https://arxiv.org/abs/2505.22954)明确优化可编辑的 harness-code repository。

[**DGM（Darwin Gödel Machine）**](https://arxiv.org/abs/2505.22954)与前面主要优化 solution program 的方法不同，它明确把可编辑的 harness-code repository 作为演化对象，同时固定 base model。其循环是：

1. 从 population 中的一个 coding agent 开始。
2. 每轮选择一个 parent；选择概率与 performance 成正比、与它已经产生的 children 数量成反比，从而兼顾利用高分方案和探索不同分支。
3. Parent agent 阅读自己的 benchmark evaluation log，然后用 `bash` 和 editor 工具修改自己的 harness codebase，branch 出一个新版本 coding agent。
4. 对新 agent 进行评估，只有 performance 足够高的版本才加入 population。
5. 重复选择、修改和评估，直到满足停止条件。

Weng 将 DGM 明确称为 **fixed model 下的 harness evolution**。她还转述了实验结果：使用 Claude 3.5 Sonnet 作为固定 base LLM、从简单初始 harness 出发，DGM 产生的 agents 在 SWE-bench Verified 上从 20% 提升到 50%，在 Polyglot 上从 14.2% 提升到 30.7%，能够达到或超过手工 agent。

Weng 在该 section 的结尾指出：这类进化式程序搜索适合候选能够自动评估、fitness 容易量化的任务，例如矩阵乘法、GPU kernel、算法竞赛和数据中心调度；在评估缓慢、模糊或主要依靠启发式判断的领域会更困难，计算效率与进化效果本身也是问题。

> **对当前案例层级的总结**：这里介绍的主要工作基本都停留在优化 Harness / scaffolding。AFlow 用固定的 MCTS 优化 workflow；Self-Harness 使用固定的 propose-evaluate-accept procedure 优化 harness；AHE 使用固定的 observability-driven framework 优化 harness components；DGM 使用给定的 parent selection、mutation 和 fitness evaluation 机制演化 harness code；Meta-Harness 搜索 harness code，但 Meta-Harness 的 outer-loop algorithm 本身没有成为被优化对象。Promptbreeder 让 mutation prompt 一起演化、AlphaEvolve 让 meta-prompt 一起演化，已经触及搜索机制中的局部组件，但仍不能直接概括为“整个 Harness optimizer 在自我改进”。

### 4.7 分类博客：Prompt、Memory、Tool、Skill 与 Multi-agent

以上 4.2-4.6 是 Weng 博客从 design pattern 到 harness optimization 的组织方式。分类博客采用了另一种视角：它不按 Harness 的工程演化路径展开，而是把已经部署后的 Agent Harness Self-improvement 概括为 prompt / memory、tool / skill，以及进一步的 multi-agent self-evolving。

分类博客先介绍两类常见的 harness self-improvement：

1. **Prompt learning and memory**：与其记住每个问题和答案，更可扩展的做法是从轨迹中提取可复用规则，存入 prompt、playbook 或 memory。
2. **Tool and skill creation**：文字记忆不总是够用。例如，要从长视频中抽取关键帧，更需要一个可执行工具。Tool 由代码编码，agent 可以直接生成；**skill 可以视为 tool 的更高层封装**，也可以视为 context management，因为它避免把全部操作细节长期放进 context window。

随着 playbook、tool 和 skill 增多，单个 agent 会变得低效或混乱。分类博客因此进一步讨论 **multi-agent self-evolving**：为不同任务建立 specialist，由 router 将任务分给合适的 expert。它也可以被看作 context management 的扩展，因为每个 expert 只携带与自身任务有关的 context。关键瓶颈是 routing，而有效 routing 往往需要更强的 base model 或人类专家。

因此，两篇博客不是在提出两套相互竞争的分类：Weng 关注 Harness 的设计原则、优化对象与 RSI 路径；分类博客关注部署后 Harness 可以在哪些组件层面发生 self-improvement。

### 4.8 知乎博客补充的 Harness 案例与反面评估

以下案例来自[知乎博客](https://zhuanlan.zhihu.com/p/2065227313973825752)。它们既包括 harness 设计，也包括真正把 harness 自身放进更新循环的方法。

#### [Hermes](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills)：把经验写成可复用 Skill

知乎博客介绍，Hermes Agent 在一次任务使用工具五次以上时，可以把这次经验自动写成新的 `SKILL.md`。后台 Curator 跟踪 skill 的使用和修改情况，让长期未使用的 skill 经历“活跃 → 陈旧 → 归档”，并定期让小模型审查、合并近似重复的 skill。这个案例对应分类博客中的 tool / skill creation，也说明 skill 不能只增加而不管理生命周期。

#### [MiniMax M2.7](https://www.minimax.io/news/minimax-m27-en)：迭代 Scaffold

知乎博客转述 MiniMax 的案例：M2.7 自主执行“分析失败轨迹 → 规划修改 → 修改 scaffold code → 运行评测 → 比较结果 → 保留或回退”，持续 100 多轮后使内部评估集性能提高 30%。博客还转述其在 RL 团队实验 workflow 中可以接管 30%-50% 的端到端流程，人类研究员在关键决策时介入。

#### [Apodex](https://www.apodex.com/blog/apodex-1.0)：Multi-agent 与显式验证

Apodex-1.0 用 orchestrator 协调最多 150 个并行 sub-agent，结果进入共享 report pool；遇到报告冲突、主张缺乏证据或最终草稿需要检查时，再路由到 conflict reviewer、fact checker 和 draft reviewer，最后由 global verifier 汇总。该案例主要说明一种“multi-agent + explicit verification”的 harness 结构；它展示的是 harness design，本身并没有像 RHI 那样给出跨轮重写 harness 的更新循环。

#### [RHI](https://arxiv.org/abs/2607.15524)：LLM Evaluator 驱动 Harness 自我重写

Recursive Harness Self-Improvement（RHI）的循环是：agent 用当前 harness 解决任务；LLM evaluator 把本次 output 与上一版做成对比较；偏好反馈进入 self-comparison history；harness optimizer 读取历史，把 harness 更新到下一版。

RHI 把 harness 分为 agent design 与 agent workflow；workflow 又分为 contract 和 hop。它优先改 workflow，让 task-specific contract **精确规定 agent 之间真正需要传递的信息**，从而减少冗余 context 传播、提高 KV-cache 命中率。知乎博客报告，在 30 个量化金融、机器人和制药方向的 ML research task 上，几轮迭代可以让低推理强度配置超过同模型的最高推理强度配置，并把推理成本最多降低 60%。

#### [Ai2 的反面评估](https://arxiv.org/abs/2607.12227)：预算对等后，Harness Evolution 未必更好

知乎博客也保留了反面结果。Ai2 的评估指出两个问题：第一，harness evolution 应与使用相同反馈和推理预算的 test-time scaling baseline 比较；第二，搜索 harness 与最终报告结果不能使用同一 benchmark，否则容易过拟合。

在其转述的 Terminal-Bench 2.1 结果中，Harness Evolution 得分 67.4，低于初始 harness baseline 的 68.2，也低于 Parallel Sampling（72.3）、Sequential Refinement（69.3）和 Harness Scaling（71.8）。因此，自动搜索得到更高分并不能单独证明 harness 学到了可迁移的改进，也可能只是使用了更多搜索预算。

#### [AIDE²](https://www.weco.ai/blog/first-evidence-of-recursive-self-improvement)：外层 Agent 改进内层 Agent

AIDE² 把问题做成双层优化：外层 AIDEhuman 提出对内层 agent code 的修改，内层 AIDE0 在 harness engineering、algorithm 和 ML engineering 等任务上接受评估；只有优于当前最好版本的提案才会保留。知乎博客报告，这一过程运行 8 天、100 步，约 10% 提案被接受，得到的 AIDE85 在两个分布内 benchmark 和一个分布外 WeatherBench 2 上都超过 AIDE0。

为回应“搜索预算”和“泛化”问题，实验采用 public/private score 分离、固定 cost budget 和外部 benchmark。博客还列出 AIDE85 自己形成的修改：多臂老虎机式草稿子树搜索、将完整历史 context 压缩 16 倍、修复 evaluation script bug，以及加入三层 reward-hacking guardrail，使博客报告的 reward-hacking rate 从 63% 降至 34%。

---

## 5. Model Learning without Gold Answers

### 5.1 基本定义

[分类博客](https://lsl.zone/blog/2026/a-taxonomy-of-self-evolving-agents/)把第三层定义为直接更新 model。关键问题是：没有 gold answer，只有问题、弱信号或可选的环境交互时，如何产生模型更新信号。

许多工作不会把自己称为 self-evolving agent，而会使用 self-training、weak supervision、self-play、reinforcement learning、test-time training、online learning 或 continual learning 等名称。与前两层最直接的差别是，这一层会改变 model weights。

### 5.2 Pseudo Ground Truth 与 Internal Signals

没有标准答案时，可以像 [self-training](https://arxiv.org/abs/2202.12040) 一样从数据自身构造 pseudo ground truth，或者像 [TTRL](https://arxiv.org/abs/2504.16084) 一样使用模型内部信号。Pseudo label 可以用于 SFT；能够转化为 reward 的信号可以用于 RL。

分类博客举了数苹果的例子：即使不知道真实数量，预训练模型给出的估计仍可能好于随机猜测；模型对 4、5、6 等答案的相对置信度不是完美标签，但仍然包含可用于学习的信息。

### 5.3 Self-play 与环境弱信号

学习信号也可以来自模型外部。[SPIN](https://arxiv.org/abs/2401.01335) 和 [Absolute Zero](https://arxiv.org/abs/2505.03335) 是 self-play 的例子；另一个 player 也可以被视为环境的一部分。Agent 还可以直接通过环境交互获得弱信号。

分类博客用日常例子说明：邀请某人出去但没有收到回复，“没有回复”本身也提供了信息。环境不一定给出标准答案，弱反馈仍然可能构成学习信号。

### 5.4 [Test-time Training](https://test-time-training.github.io/)

Test-time Training（TTT）解决相似问题，但采用很不同的方法。一些 sequence model 可以被解释为在 inference 过程中执行某种 gradient-based update；在这个意义上，模型在推理时持续更新一个 matrix。分类博客也明确指出，这一研究方向本身并不称自己为 self-evolving。

### 5.5 [Continual Learning](https://arxiv.org/abs/2302.00487)

Continual learning 也常被称为 online learning 或 lifelong learning。经典问题是 catastrophic forgetting：模型在学习新类别时可能忘记旧类别，一个有效方法是在学习新数据时回放部分旧数据。

分类博客同时提醒，同一个术语的含义会随时间变化。今天 LLM 语境中的 continual learning，往往比传统 catastrophic-forgetting setting 更接近 self-evolving agent 的讨论。

---

## 6. 三层如何相互反哺，并走向 RSI？

### 6.1 Harness 与 Model 的联合优化

前面的案例大多固定 Model、优化 Harness，或固定 Harness、更新 Model weights。更完整的 self-improvement 则允许系统把两者放进同一个反馈循环。SIA 与 Continual Harness 分别展示了两种联合优化方式。

#### [SIA](https://arxiv.org/abs/2605.27276)：在两个优化对象之间选择

Weng 在 **Joint Optimization with Model Weights** 中指出，harness evolution 改变模型周围的非参数系统；为了实现更完整的 self-improvement，可以允许系统同时更新 model weights。SIA 是较早把 harness improvement 和 model-parameter update 放进同一个 optimization loop 的尝试：

- **Meta-Agent**：提出初始 harness；
- **Task-Specific Agent**：执行任务；
- **Feedback-Agent**：根据近期轨迹，决定下一轮更新 harness，还是更新模型权重。

知乎博客用“两个旋钮”帮助理解：harness 与 model weights 是同一反馈循环中两种可选择的更新对象，Feedback-Agent 负责决定当前应更新哪一个。Meta-Agent 根据 task specification 和 verifier 初始化 scaffold；Task-Specific Agent 在 environment 中执行并产生 trajectory；Feedback-Agent 读取 trajectory，决定修改 scaffold 还是触发 LoRA weight update，然后把新状态送回 Task-Specific Agent，直到用完 step budget。博客还报告，SIA-W+H 在 LawBench、TriMul GPU kernel 和 MAGIC 单细胞 RNA 去噪三个任务上都超过只更新 harness 的 SIA-H，并据此强调 weight update 不是一个没有作用的附加模块。

Weng 同时强调 SIA 的证据仍是 provisional：实验中的 task-specific agent 明显弱于 Meta-Agent 和 Feedback-Agent，baseline 也较弱，使结果难以清晰解释；training stability 和 Goodhart effect 等问题仍未解决。

这里两篇博客提供的是互补信息：知乎博客介绍系统设计及论文报告的正向结果；Weng 则提醒这些实验选择存在 confound，不能把论文结果直接扩写成已经得到充分验证的结论。

#### [Continual Harness](https://arxiv.org/abs/2605.09998)：让两个循环以不同频率运行

Weng 介绍的 Continual Harness 在长时程游戏环境中同时进行 harness update 和 policy model co-learning。

[知乎博客](https://zhuanlan.zhihu.com/p/2065227313973825752)把它解释成两个不同频率的循环：

- 内层在一局游戏中高频更新 prompt、sub-agent、skill 和 memory tree 等 harness state；
- 外层跨迭代运行 policy model，由 PRM 对 trajectory 打分，强 teacher 重新标注低奖励片段，再用 soft SFT 更新 model weights，而且下一轮不重置上一轮状态。

知乎博客报告，在较强的 Gemini Pro 档模型上，这一系统以 130 美元中位成本完成 100% 的游戏里程碑，而极简 baseline harness 以 215 美元达到 98%；但在较弱的 Flash-Lite 档位上，加入 Continual Harness 后完成度反而从 baseline 的 20% 降到 3%-13%，成本也更高。这个结果也说明，harness 能否带来收益仍取决于 base model 是否有能力正确利用它。

### 6.2 三层边界逐渐模糊并相互促进

分类博客的 **A Blurred Boundary** 与 **For the Real World** 两节指出，Model、Harness 与 Artifact 是三个不同入口，但不应永远孤立：

- 优化 kernel 时，直接目标是 artifact；为了提高搜索效率，也可能需要改进 agent 的 prompt、tool、memory 或 search strategy。
- Agent 的知识受 model pre-training 限制；harness 到达上限后，更新模型参数会成为自然下一步。
- 更强 model 可以产生更好的 harness；更好的 harness 加速 artifact search；更好的 artifact 又可以产生用于 model learning 的数据和反馈。

分类博客把“每个模块最终一起改进”作为未来方向。它描述的是三层逐渐共同进化，而不是抹去三层在直接优化对象上的区别。

---

## 7. 共同挑战

以下问题主要来自 [Weng 博客的 Future Challenges](https://lilianweng.github.io/posts/2026-07-04-harness/#future-challenges)：

1. **Weak and fuzzy evaluators**：许多科研和真实世界任务没有快速、精确的 verifier；research taste、novelty 和长期科学价值尤其难量化。
2. **Context and memory lifecycle**：agent 越自主，memory 越大；harness 必须在长程任务中管理 context。Weng 认为 context engineering 最终应该成为 intelligence 的核心组成部分，而不应一直停留在 software layer。
3. **Negative results**：训练数据中的成功案例远多于失败案例，模型可能不擅长承认失败、放弃假设或报告负面结果。科研 harness 应让失败尝试容易保存，因为从失败中学习可以缩小搜索空间。
4. **Diversity collapse**：Evolutionary 和 RL loop 容易反复利用已知高奖励模式，使 population 坍缩为同一种方案的变体。
5. **Reward hacking**：系统会优化它得到的任何信号。Unit test、judge model 或 benchmark 都可能被过拟合或利用。Evaluator 和 permission control 很可能应位于 harness evolution loop 之外，并配合 held-out test、trace audit 和关键节点人工审核。
6. **Long-term success**：当前 agent 容易围绕短期指标优化，但 repo 的可维护性、ownership boundary、migration cost、backward compatibility 和未来调试负担很难由短期 sandbox reward 表达。
7. **The role of humans**：人类不应简单地被移出循环，而应在合适时间、以合适抽象层级提供监督和 steering。

---

## 8. Takeaways：我从 Self-evolving 走向 RSI 的几点理解

### 8.1 严格的RSI 不只是让结果变好，而是让“变好的机制”也变好

宽泛地说，持续改进 artifact、harness 或 model 中的任何一层，都可以放进 self-evolving 的讨论中。但我更愿意把 **RSI（Recursive Self-Improvement）** 留给一种更严格的循环：系统不仅在这一轮得到更好的结果，还能利用这一轮的经验，改进下一轮产生结果的机制。

反复修改一篇文章，让文章越来越好，是 artifact optimization；如果系统还能从修改过程里总结出更好的评估标准、搜索策略或修改方法，并在下一篇文章中更有效地改进，这个循环才开始具有 recursive 的意味。关键不在于是否同时修改 Artifact、Harness 和 Model 三层，而在于：**改进能力本身有没有进入反馈循环。** 三层互相反哺，是目前实现这种循环的一条现实路径，但不是 RSI 的定义本身。

因此，判断一个案例时，我认为最有用的不是先争论它是否配得上 RSI 这个名字，而是问：**什么在变？反馈从哪里来？反馈改变的是当前答案，还是产生答案的方法？这个 loop 下一轮能否因此运行得更好？**

### 8.2 很多优化问题，本质上可以重新表述为搜索问题

无论被优化的是代码、prompt、workflow 还是 model weights，一个 self-evolving loop 都可以理解成：定义搜索空间，提出候选，用反馈排除或保留路径，再决定下一步往哪里探索。LLM 带来的变化，是 candidate generator 和 optimizer 都变得更通用：它既能提出修改，也能阅读执行结果、分析失败并调整搜索方向。

从这个视角看，系统性能不只取决于模型“有多聪明”，还取决于几个更具体的问题：目标能否被清楚地 formulate，反馈是否可靠，搜索空间是否足够大，候选生成是否足够快，以及系统能否记住已经验证过的路径。把一个模糊任务转成有候选、有验证器、有历史状态的搜索问题，往往就是构建 self-evolving system 最重要的一步。

哪家效果更好可能要取决于哪家搜得快，比如单位时间内实验迭代的次数（我记得之前采访OpenAI研究员说过类似的观点）

### 8.3 负样本不是搜索中的废料，而是对搜索空间的约束

成功样本告诉系统哪条路可能有效，失败样本则告诉系统哪些区域不值得重复探索。后者不仅用于“复盘错误”，还在持续缩小搜索空间：一次失败的实验、一个被回滚的 patch、一条没有提升指标的 prompt，都可以成为下一轮搜索的边界条件。

这也是为什么只保存 best result 不够。一个成熟的 loop 还应该保存失败发生时的假设、环境、修改、观测和判断依据，并区分“方案本身无效”与“评估噪声、执行错误或预算不足”。如果系统不能可靠地承认失败、记录失败和调用失败，它就容易反复走回同一条路；如果把未经判断的负样本全部塞回 context，又会制造新的噪声。真正重要的是让负面结果变成**可检索、可归因、能约束后续搜索**的经验。

### 8.4 Harness 的未来不是无限复杂，而是成为简单、通用、可进化的接口

Harness 是近期最容易获得工程收益的一层，因为它像软件一样可组合、可观测、可回滚，也能在不重新训练模型的情况下快速迭代。但短期有效不等于长期应该不断堆叠 workflow、agent role 和 heuristic rule。复杂 harness 往往是在替当前模型补能力缺口；随着模型变强，其中一部分机制会被内化到 model behavior 中。

我更认同的方向是：**Harness 内部可以处理复杂性，对模型暴露的接口则应尽量简单、稳定和通用。** 它应该负责连接模型与外部 context、memory、tool、environment 和 evaluator，保存可复现的轨迹，并为搜索提供必要的状态与边界；至于具体怎样规划、推理和纠错，应尽量交还给模型，而不是固化成越来越厚的手工规则。

真正有价值的 harness self-improvement，也不只是为某个 benchmark 找到一套更长的 prompt，而是让系统逐渐学会：该保留什么 context、该创建什么工具、该如何组织实验、该在什么时候修改 artifact、harness 或 weights。换句话说，Harness 应从一组人为拼接的技巧，走向支持改进方法本身的 **meta-methodology**。

### 8.5 最后：RSI 的核心不是“无人参与”，而是“反馈能够积累”

现阶段的 evaluator 仍然不完美，真实世界反馈昂贵且缓慢，reward hacking、diversity collapse 和长期目标错配也都没有解决。因此，RSI 不应被理解成简单地把人移出 loop。更现实的目标，是让人把目标、约束、权限和关键判断放在合适的抽象层级，把可验证、可重复的局部搜索交给系统，并让每一轮反馈都能成为下一轮真正可用的经验。这里面最重要的可能就是**评估要准，feedback要可靠**
