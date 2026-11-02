# Synapse Chat

An [AI chatbot](https://ai-chat-artifacts.onrender.com/) that supports chat artifacts (like Claude), Bing web search (like Perplexity.ai), multi-turn agentic workflows, open source models, advanced CoT logic, adjustable reasoning effort, automatic model routing, memory, vision, file upload, and much more.

## Setup

1. Clone the repository
2. Create a `.env` file and fill in the appropriate API keys from the `.env.example` file
3. Install the dependencies:

   ```bash
   npm install
   ```

4. Build the project:

   ```bash
   npm run build
   ```

5. Start the server:

   ```bash
   npm run start
   ```

Make sure to replace any placeholders in the `.env.example` file with your actual API keys and configuration settings.

## Features

- **Chat Artifacts**: Supports chat artifacts similar to Claude.
- **Bing Web Search**: Provides up-to-date results with Bing Search, similar to Perplexity.ai.
- **Multi-turn Agentic Workflows**: Facilitates complex interactions with multiple turns.
- **Open Source Models**: Integrates with various open-source models.
- **Advanced CoT Logic and Reasoning**: Utilizes advanced Chain-of-Thought logic for better reasoning.
- **Memory**: Remembers previous interactions to provide context-aware responses.
- **Vision**: Supports image recognition and processing.
- **File Upload**: Allows users to upload files for processing.
- **Interactive Web Applications**: Generates interactive web applications using AI within the chat window.
- **Image Search and Generation**: Searches for images and generates them with OpenAI GPT Image.
- **Interactive Charts**: Creates interactive charts using Mermaid.
- **Slideshow Generation**: Compiles research and images into slideshows.
- **Real-time Information**: Provides up-to-date time and weather information.
- **Customization**: Offers various parameters for customization.
- **Artifact Publication**: Allows users to publish and share artifacts.

## Screenshots

### Choose from several frontier models from a variety of providers such as OpenAI, Anthropic, and Meta

![image](https://github.com/user-attachments/assets/cb5dd68c-f5f7-4b97-b584-9e74a0c267c9)

### Up-to-date results with Bing Search & Wikipedia Integration

![Screenshot 2024-07-26 171138](https://github.com/user-attachments/assets/776d10e6-48c4-4af2-b26f-f6e3592637c5)
![Screenshot 2024-07-28 103827](https://github.com/user-attachments/assets/e8ed87a4-e436-4f15-bb33-bb53a2e9f7aa)
![Screenshot 2024-08-21 000849](https://github.com/user-attachments/assets/e7f5aeef-bd6d-40f2-b146-6cbf8837b1fb)

### Generate interactive web applications using AI inside the chat window with Artifacts

![synapse-chat-paint](https://github.com/user-attachments/assets/0970023f-968d-442b-aba2-1d24708fa8f2)
![Screenshot 2024-08-21 000434](https://github.com/user-attachments/assets/a7dffe18-34af-4d66-bb6c-7e7beb9529d7)
![Screenshot 2024-11-02 195228](https://github.com/user-attachments/assets/7ba689e7-f920-4377-960b-5c036a49cd9a)

### Generate interactive charts using Mermaid

![Screenshot 2024-08-21 001051](https://github.com/user-attachments/assets/c65c2cb5-af45-421a-90e7-9f573a65d271)

### Search for images

![Screenshot 2024-08-21 001135](https://github.com/user-attachments/assets/b0dd4b51-58ea-40fb-bbf9-075e8bbcdb4a)

### Generate slideshows from the research and images compiled or generated in the chat

![Screenshot 2024-08-21 001301](https://github.com/user-attachments/assets/00fa3254-283e-4b95-acdc-bfc3ff5d4cdf)

### Generate charts and graphs to make your data interactive

![Screenshot 2024-11-02 195337](https://github.com/user-attachments/assets/0c70f3ed-6850-4103-a486-a2ffee360e91)

### Generate Images with OpenAI GPT Image

![image](https://github.com/user-attachments/assets/0d318657-bc85-43ef-b108-e82b16aa7667)

### Get up-to-date time and weather information

![image](https://github.com/user-attachments/assets/cac2ab53-d7a5-41ac-b7df-2cad34e1b7a9)

### Customize several parameters

![image](https://github.com/user-attachments/assets/7d9ea2db-787e-4422-a6a8-c6d4fba927ce)

### Publish artifacts and share them with others

![image](https://github.com/user-attachments/assets/ce69ef3a-68f8-4fe1-96e8-66f579cc01bd)
![image](https://github.com/user-attachments/assets/d3609251-aa2c-432e-9eed-d5d4f653e273)
![image](https://github.com/user-attachments/assets/a706f5e8-42c8-48f1-87ca-43cdcbb315f4)
![image](https://github.com/user-attachments/assets/b124cd4f-1f2e-4b56-acf9-dd9f576676ae)

## Supported Models

### OpenAI

| Model Name     | Model Key    | Max Tokens |
|----------------|--------------|------------|
| GPT-6 Astra    | `gpt6astra`  | 128,000    |
| GPT-6.1 Sol    | `gpt61sol`   | 128,000    |
| GPT-6.1 Terra  | `gpt61terra` | 128,000    |
| GPT-6 Luna     | `gpt6luna`   | 128,000    |

### Anthropic

| Model Name        | Model Key        | Max Tokens |
|-------------------|------------------|------------|
| Claude Opus 5.5   | `claudeopus55`   | 128,000    |
| Claude Sonnet 5.5 | `claudesonnet55` | 128,000    |
| Claude Haiku 5.5  | `claudehaiku55`  | 128,000    |
| Claude Fable 5.1  | `claudefable51`  | 128,000    |

### Groq

| Model Name                           | Model Key                      | Max Tokens |
|--------------------------------------|--------------------------------|------------|
| GPT-OSS 120B                         | `gptoss120b`                   | 65,536     |
| GPT-OSS 20B                          | `gptoss20b`                    | 65,536     |
| Qwen 3.8 27B                         | `qwen38_27b`                   | 16,384     |

### Custom Synapse Chat Models

| Model Name   | Model Key    | Max Tokens |
|--------------|--------------|------------|
| Auto         | `auto`       | -          |
| Agents       | `agents`     | -          |
