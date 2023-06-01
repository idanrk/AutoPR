#!/usr/bin/env node
const axios = require('axios');
const simpleGit = require('simple-git');
const git = simpleGit();
const { OpenAIApi } = require('openai');

// Initialize OpenAI API with key
const openai = new OpenAIApi({
    apiKey: process.env.CHATGPT_API_KEY || '',
});

const main = async () => {
    const targetBranch = process.env.CREATE_PR_TARGET || 'main';
    const githubToken = process.env.GITHUB_TOKEN;

    if (!githubToken) {
        console.error('GITHUB_TOKEN environment variable is not set');
        return;
    }

    // Get branch name
    const branchSummary = await git.branch();
    const currentBranch = branchSummary.current;

    // Get commit messages
    const log = await git.log();
    const commitMessages = log.all
        .filter(commit => commit.refs.includes(currentBranch))
        .map(commit => commit.message)
        .join('. ');

    let description = '';
    try {
        description = await fs.readFileSync('.pr-description', 'utf-8');
    } catch (err) {
        // .pr-description file not found. Generate description using OpenAI ChatGPT
        const chatGptResponse = await openai.complete({
            model: process.env.CHATGPT_MODEL || 'text-davinci-002',
            prompt: commitMessages,
            temperature: process.env.CHATGPT_TEMPERATURE || 0.7,
            max_tokens: process.env.CHATGPT_MAX_LENGTH || 1024,
        });

        description = chatGptResponse.data.choices[0].text;
    }

    // Create PR
    const { data } = await axios.post(
        `https://api.github.com/repos/{your-repo-owner}/{your-repo-name}/pulls`,  // Replace with your repository path
        {
            title: `PR from ${currentBranch}`,
            head: currentBranch,
            base: targetBranch,
            body: description,
        },
        {
            headers: {
                'Authorization': `token ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        },
    );

    console.log('PR created:', data.html_url);
};

main().catch(console.error);