---
permalink: /publications/
title: "Publications"
author_profile: true
redirect_from: 
  - /publications.html
---

My research centers on building trustworthy knowledge-intensive AI systems, organized around a unified question-answering pipeline: given a user query, (1) understanding what the query is truly asking, (2) assessing whether the model knows the answer, (3) evaluating whether external evidence is reliable, and (4) effectively leveraging external knowledge when needed. Each stage addresses a critical challenge in ensuring that AI systems produce accurate, honest, and well-grounded responses.

{% for group in site.data.publications %}
## {{ group.section }}

{% if group.subtitle %}<p class="publication-section-subtitle">{{ group.subtitle }}</p>{% endif %}
{% for paper in group.papers %}
  {% include publication-card.html paper=paper %}
{% endfor %}
{% endfor %}

<sup>†</sup> Equal contribution.
