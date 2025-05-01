const express = require('express');
const axios = require('axios');
require('dotenv').config();
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Image generation function
async function generateImageFromPrompt(prompt) {
    const params = new URLSearchParams();
    params.set('prompt', prompt);
    params.set('width', '1024');
    params.set('height', '1024');
    params.set('seed', '918440');
    params.set('model', 'flux');

    try {
        const response = await axios.post(
            'https://ai-text-to-image-generator-flux-free-api.p.rapidapi.com/aaaaaaaaaaaaaaaaaiimagegenerator/fluximagegenerate/generateimage.php',
            params,
            {
                responseType: 'arraybuffer',
                headers: {
                    'x-rapidapi-key': process.env.RAPIDAPI_KEY,
                    'x-rapidapi-host': 'ai-text-to-image-generator-flux-free-api.p.rapidapi.com',
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        const folderPath = path.join(__dirname, '..', 'public', 'generated');
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }

        const filename = `image_${crypto.randomUUID()}.png`;
        const filepath = path.join(folderPath, filename);
        fs.writeFileSync(filepath, response.data);

        const imageUrl = `/generated/${filename}`;
        // console.log("🖼️ Saved Image URL:", imageUrl);
        return imageUrl;
    } catch (err) {
        console.error('❌ Image generation error:', err.message);
        return null;
    }
}

// Blog generation route
router.post('/generate-blog', async (req, res) => {
    const topic = req.body.topic;
    const API_KEY = process.env.AI_API_KEY;
    const AI_URL = process.env.AI_URL;

    if (!topic) {
        return res.status(400).json({ error: "Topic is required" });
    }

    try {
        const aiResponse = await axios.post(`${AI_URL}?key=${API_KEY}`, {
            contents: [{
                parts: [{
                    text: `Give me a JSON with keys "title", "description", and "image_prompt" for a blog based on this topic: ${topic}`
                }]
            }]
        });

        // Extract and clean response
        const rawText = aiResponse.data.candidates[0].content.parts.map(p => p.text).join('\n');
        const cleanedText = rawText.replace(/```json|```/g, '').trim();

        // Attempt to parse
        let parsed;
        try {
            parsed = JSON.parse(cleanedText);
        } catch (e) {
            console.error("❌ Failed to parse AI JSON:", rawText);
            return res.status(500).json({ error: "Failed to parse AI response" });
        }

        const { title, description, image_prompt } = parsed;
        let imageUrl = "No image URL generated";

        if (image_prompt) {
            const generatedImage = await generateImageFromPrompt(image_prompt);
            if (generatedImage) {
                imageUrl = generatedImage;
            }
        }

        // console.log("✅ Generated Title:", title);
        // console.log("✅ Generated Description:", description);
        // console.log("✅ Generated Image URL:", imageUrl);

        res.json({ title, description, imageUrl });

    } catch (error) {
        console.error("❌ Blog generation error:", error.message);
        res.status(500).json({ error: "An error occurred while generating the blog" });
    }
});

module.exports = router;
