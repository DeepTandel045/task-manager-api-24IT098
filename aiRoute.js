const aiRateLimitMap = new Map();

module.exports = function (app, authMiddleware) {
    app.post(
        ["/api/ai/generate-description", "/ai/generate-description"],
        authMiddleware,
        async (req, res) => {
            try {
                // Hot reload environment variables in case .env was recently updated
                require("dotenv").config();

                const { title } = req.body;

                if (!title || !title.trim()) {
                    return res.status(400).json({
                        message: "Task title is required to generate description",
                    });
                }

                // Rate limiting: 1 second cooldown per user (prevents spam while allowing smooth testing)
                const userId = req.user?.id || req.ip;
                const now = Date.now();
                const lastRequest = aiRateLimitMap.get(userId) || 0;
                const cooldown = 1000;

                if (now - lastRequest < cooldown) {
                    const waitSec = Math.ceil(
                        (cooldown - (now - lastRequest)) / 1000
                    );
                    return res.status(429).json({
                        message: `Please wait a second before requesting another AI suggestion.`,
                        rateLimited: true,
                    });
                }

                aiRateLimitMap.set(userId, now);

                let generatedDescription = "";
                let suggestedPriority = "medium";
                let isFallback = false;

                const prompt = `Write a short, professional, 1-2 sentence task description and recommend priority (low, medium, or high) for: "${title.trim()}". Keep it concise, actionable, and under 30 words.`;

                // 1. Attempt OpenAI if key is configured
                const openAiKey = process.env.OPENAI_API_KEY?.trim();
                if (
                    openAiKey &&
                    !openAiKey.startsWith("your_") &&
                    openAiKey !== "dummy_key"
                ) {
                    try {
                        const OpenAI = require("openai");
                        const client = new OpenAI({ apiKey: openAiKey });
                        const completion = await client.chat.completions.create({
                            model: "gpt-4o-mini",
                            messages: [
                                {
                                    role: "system",
                                    content:
                                        "You are a helpful assistant for a task management application. Write concise, actionable task descriptions (max 30 words).",
                                },
                                { role: "user", content: prompt },
                            ],
                            max_tokens: 60,
                        });
                        generatedDescription =
                            completion.choices[0]?.message?.content?.trim() || "";
                    } catch (apiErr) {
                        console.warn(
                            "[AI Warning] OpenAI call failed, falling back to Gemini/Local:",
                            apiErr.message
                        );
                    }
                }

                // 2. Attempt Gemini if Gemini key is configured
                const geminiKey = process.env.GEMINI_API_KEY?.trim();
                if (
                    !generatedDescription &&
                    geminiKey &&
                    !geminiKey.startsWith("your_")
                ) {
                    const models = [
                        "gemini-1.5-flash",
                        "gemini-2.0-flash",
                        "gemini-1.5-pro",
                    ];
                    for (const model of models) {
                        try {
                            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
                            const geminiRes = await fetch(geminiUrl, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify({
                                    contents: [{ parts: [{ text: prompt }] }],
                                    generationConfig: { maxOutputTokens: 60 },
                                }),
                            });
                            if (geminiRes.ok) {
                                const geminiData = await geminiRes.json();
                                const candidateText =
                                    geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
                                if (candidateText) {
                                    generatedDescription = candidateText;
                                    break;
                                }
                            } else {
                                const errBody = await geminiRes.text();
                                console.warn(
                                    `[AI Warning] Gemini ${model} returned ${geminiRes.status}:`,
                                    errBody
                                );
                            }
                        } catch (geminiErr) {
                            console.warn(
                                `[AI Warning] Gemini ${model} request error:`,
                                geminiErr.message
                            );
                        }
                    }
                }

                // 3. Graceful degradation: intelligent context-aware generator for ANY task title
                if (!generatedDescription) {
                    isFallback = true;
                    const lower = title.toLowerCase();

                    // Dynamic rule-based classification based on action keywords
                    if (
                        lower.includes("bug") ||
                        lower.includes("fix") ||
                        lower.includes("issue") ||
                        lower.includes("error") ||
                        lower.includes("crash") ||
                        lower.includes("fail") ||
                        lower.includes("broken")
                    ) {
                        generatedDescription = `Investigate root cause of "${title.trim()}", debug execution flow, apply code patch, and verify with automated unit tests.`;
                        suggestedPriority = "high";
                    } else if (
                        lower.includes("deploy") ||
                        lower.includes("docker") ||
                        lower.includes("prod") ||
                        lower.includes("release") ||
                        lower.includes("ci") ||
                        lower.includes("cd") ||
                        lower.includes("pipeline") ||
                        lower.includes("server")
                    ) {
                        generatedDescription = `Verify environment configurations, test build containers, and deploy "${title.trim()}" to production environment with monitoring.`;
                        suggestedPriority = "high";
                    } else if (
                        lower.includes("test") ||
                        lower.includes("qa") ||
                        lower.includes("jest") ||
                        lower.includes("supertest") ||
                        lower.includes("audit") ||
                        lower.includes("check")
                    ) {
                        generatedDescription = `Design and execute comprehensive test assertions for "${title.trim()}" to guarantee functional correctness and code coverage.`;
                        suggestedPriority = "medium";
                    } else if (
                        lower.includes("auth") ||
                        lower.includes("login") ||
                        lower.includes("jwt") ||
                        lower.includes("security") ||
                        lower.includes("password") ||
                        lower.includes("token")
                    ) {
                        generatedDescription = `Implement and validate secure credential verification, token signing, and protected middleware for "${title.trim()}".`;
                        suggestedPriority = "high";
                    } else if (
                        lower.includes("ui") ||
                        lower.includes("frontend") ||
                        lower.includes("react") ||
                        lower.includes("component") ||
                        lower.includes("css") ||
                        lower.includes("design") ||
                        lower.includes("page")
                    ) {
                        generatedDescription = `Develop responsive user interface elements for "${title.trim()}", optimize layout responsiveness, and bind API states.`;
                        suggestedPriority = "medium";
                    } else if (
                        lower.includes("api") ||
                        lower.includes("backend") ||
                        lower.includes("route") ||
                        lower.includes("endpoint") ||
                        lower.includes("mongo") ||
                        lower.includes("database") ||
                        lower.includes("crud")
                    ) {
                        generatedDescription = `Build RESTful controller endpoints for "${title.trim()}", enforce request validation, and establish reliable database persistence.`;
                        suggestedPriority = "medium";
                    } else if (
                        lower.includes("meeting") ||
                        lower.includes("sync") ||
                        lower.includes("discuss") ||
                        lower.includes("call") ||
                        lower.includes("presentation") ||
                        lower.includes("interview")
                    ) {
                        generatedDescription = `Prepare meeting agenda for "${title.trim()}", review key discussion topics, and distribute follow-up action items.`;
                        suggestedPriority = "medium";
                    } else if (
                        lower.includes("read") ||
                        lower.includes("learn") ||
                        lower.includes("study") ||
                        lower.includes("research") ||
                        lower.includes("course") ||
                        lower.includes("practical") ||
                        lower.includes("assignment")
                    ) {
                        generatedDescription = `Study reference material and guidelines for "${title.trim()}", take summary notes, and complete practical deliverables.`;
                        suggestedPriority = "low";
                    } else if (
                        lower.includes("clean") ||
                        lower.includes("buy") ||
                        lower.includes("shop") ||
                        lower.includes("call") ||
                        lower.includes("pay") ||
                        lower.includes("bill") ||
                        lower.includes("gym") ||
                        lower.includes("workout")
                    ) {
                        generatedDescription = `Complete scheduled personal activity for "${title.trim()}", verify checklist items, and mark as completed upon finish.`;
                        suggestedPriority = "low";
                    } else {
                        // Universal fallback for any custom title
                        generatedDescription = `Outline requirements and milestones for "${title.trim()}", execute core task objectives, and verify final outcome.`;
                        suggestedPriority = "medium";
                    }
                }

                return res.status(200).json({
                    title: title.trim(),
                    description: generatedDescription,
                    suggestedPriority,
                    fallback: isFallback,
                    message: isFallback
                        ? "Generated via intelligent local fallback (AI API offline or key unconfigured)."
                        : "Generated successfully by AI service.",
                    disclaimer:
                        "AI-generated content should be reviewed and verified by the user before saving.",
                });
            } catch (err) {
                console.error("AI route error:", err);
                return res.status(200).json({
                    description: `Review requirements and complete task for "${
                        req.body.title || "this task"
                    }".`,
                    suggestedPriority: "medium",
                    fallback: true,
                    message:
                        "AI service encountered an error. Provided graceful fallback suggestion.",
                    disclaimer:
                        "AI-generated content should be reviewed before saving.",
                });
            }
        }
    );
};
