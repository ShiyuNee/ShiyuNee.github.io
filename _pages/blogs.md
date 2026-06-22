---
permalink: /blogs/
title: "Blogs"
author_profile: true
---

记录我对前沿技术的思考与探索，包括技术解读、工具实践和研究笔记。

## RLVR 基础与 Slime 框架解读

面向有深度学习基础但未接触过强化学习的读者，从 RL 理论基础讲起，逐步过渡到 LLM 强化学习训练框架 Slime 的实战使用。内容涵盖 Policy Gradient、PPO、GRPO 的推导，以及 Slime 框架从 Rollout 到训练的完整流程，并附以 DCPO 自定义修改案例。

[阅读全文](/blogs/RLVR_Handbook)

## On-Policy Distillation 的前世今生

从后训练的两条路（on-policy RL vs off-policy SFT）讲起，分析各自的优缺点，引出 On-Policy Distillation 的核心思想：在学生模型生成的轨迹上，用教师模型逐 token 打分。文章对比了 RL、SFT 和 On-Policy Distillation 在奖励密度、数据复用、持续学习等方面的差异，并介绍了 Self-Distillation 的最新研究进展。

[阅读全文](/blogs/On-Policy-Distillation)

## Arxiv Daily Papers Agent

通过 Skill 让 AI Agent 每天自动追踪 arXiv 最新论文，按研究方向智能分类，为每篇论文生成精炼的中文 TL;DR，让你在 10 分钟内掌握当日研究动态。支持 30+ 研究方向分类，涵盖 Agent/RL、大模型核心、NLP 基础任务、检索、多模态等。每日更新 cs.CL 报告，可直接阅读，也可自定义类别和日期自行生成。

[GitHub](https://github.com/ShiyuNee/Arxiv-Daily-Papers-Agent){:target="_blank"}
