---
permalink: /publications/
title: "Publications"
author_profile: true
redirect_from: 
  - /publications.html
---

My research centers on building trustworthy knowledge-intensive AI systems, organized around a unified question-answering pipeline: given a user query, (1) understanding what the query is truly asking, (2) assessing whether the model knows the answer, (3) evaluating whether external evidence is reliable, and (4) effectively leveraging external knowledge when needed. Each stage addresses a critical challenge in ensuring that AI systems produce accurate, honest, and well-grounded responses.

<p class="research-overview-link"><span>Research overview</span><a href="{{ '/research/knowledge-boundaries/' | relative_url }}">Knowledge Boundaries &amp; Honest AI <span aria-hidden="true">↗</span></a><span class="research-overview-link__status">Work in Progress</span><small>A connected story of our work on self-assessment, calibration, and honesty alignment.</small></p>

{% for group in site.data.publications %}
{% unless group.hide_section %}
## {{ group.section }}
{% endunless %}

{% if group.subtitle %}<p class="publication-section-subtitle{% if group.hide_section %} publication-section-subtitle--continuation{% endif %}">{{ group.subtitle }}</p>{% endif %}
{% for paper in group.papers %}
  {% include publication-card.html paper=paper %}
{% endfor %}
{% endfor %}

<sup>†</sup> Equal contribution.
