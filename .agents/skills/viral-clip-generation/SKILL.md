---
name: viral-clip-generation
description: Use when writing or updating AI prompts for video clip selection, transcript analysis, or social media content generation
---

# Viral Clip Generation

## Overview
This skill provides the Standard Operating Procedure (SOP) for crafting AI prompts that extract highly engaging short-form video clips (TikTok, Reels, Shorts) and generate optimized metadata (titles, thumbnails, descriptions, hashtags, and B-Roll queries). 

## When to Use
- You are writing a system or user prompt for an AI provider (OpenAI, Gemini, etc.) to analyze video transcripts.
- The goal is to find viral, engaging, or short-form highlights from a long-form video.
- You need to generate social media metadata alongside the clips.

## Core Pattern: Prompt Construction

When creating the AI prompt, you **MUST** instruct the AI to follow these specific rules for each generated element:

### 1. Clip Selection (The Highlights)
Instruct the AI to select clips based on these criteria:
- **Strong Hook**: The clip must start with a captivating hook.
- **Complete Thought**: It must contain a complete thought AND a complete sentence (NEVER cut off mid-sentence or mid-word).
- **Self-Contained**: The clip must be genuinely interesting/funny/surprising on its own without needing external context.
- **Duration**: Target 15-45 seconds.
- **Precision**: Set start/end precisely on natural speech pauses (silence). Ensure that the first word is clearly spoken from the beginning and the last word finishes completely. Avoid intros, filler, and dead air.

### 2. B-Roll Query Optimization
Instruct the AI to generate highly visual and actionable B-Roll search queries:
- **Constraint**: Must be exactly 1-2 English words.
- **Relevance**: Must describe a physical, highly visual object or action that matches the core topic of the clip.
- **Avoidance**: Do not use abstract concepts (e.g., "success," "happiness") or overly specific phrases (e.g., "man running in blue shirt"). Use terms like "running," "money," "laptop," "crowd."

### 3. AI Content Generation Options
Do **NOT** ask the AI for a single title or description. You **MUST** ask the AI to provide **multiple style options** so the user has choices. Instruct the AI to generate:

#### Titles (Provide 3 Options)
- **Option 1: Clickbaity / Curiosity-Gap** (e.g., "The secret they don't want you to know 🤫")
- **Option 2: Educational / Value-Driven** (e.g., "How to scale your business in 3 steps 📈")
- **Option 3: Minimalist / Direct** (e.g., "Scaling your business.")

#### Thumbnails (Provide Textual Descriptions)
- Do not generate an image prompt for midjourney/dalle.
- Provide a **textual description** for the creator describing the layout:
  - **Visual Subject**: What should be on the screen? (e.g., "Split screen: creator pointing up, graph going down")
  - **Hook Text**: 3-5 words of high-contrast text to overlay on the thumbnail (e.g., "DON'T DO THIS").

#### Descriptions & Hashtags
- Write an engaging 2-3 sentence description tailored to the clip, ending with a clear Call-To-Action (CTA) (e.g., "Link in bio", "Follow for more").
- Provide 5-7 hashtags mixing broad trending tags (#business, #fyp) with highly niche tags specific to the content.

## Red Flags - STOP and Correct
If the prompt you are generating for the AI contains any of these red flags, correct it immediately:
- ❌ Asking the AI for "a title and description" (Must ask for *multiple style options*).
- ❌ Asking for an image generation prompt (Must ask for *textual layout description and hook text*).
- ❌ Forgetting to mandate complete sentences and speech pauses for the start/end timestamps.
- ❌ Allowing long B-Roll queries (Must be strictly 1-2 words).

## Example: Perfect AI Prompt Structure
If you are writing the instruction block for the AI, it should look something like this:

```text
Analyze the transcript and find the most engaging 15-45s highlights for TikTok/Reels. 
For each highlight:
1. Ensure it starts on a strong hook, contains a complete thought, and sets start/end precisely on natural speech pauses. Do not cut off mid-word.
2. Provide a 'broll_query_en' strictly limited to 1-2 visual English words (e.g., "laptop", "running").
3. Generate 3 Title options: Clickbait, Educational, and Minimalist.
4. Generate a Thumbnail layout description including the visual subject and a 3-5 word Hook Text overlay.
5. Generate an engaging description ending with a CTA, and 5-7 hashtags (mix of broad and niche).
Return the result strictly as a JSON object.
```
