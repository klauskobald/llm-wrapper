// create a client for the server
import { Client } from "./client"
import fs from "fs"

const apiKey = "iskdhnc7zdh555dhsj892hf"
const client = new Client("http://localhost:3000", apiKey)

const userPrompt = fs.readFileSync("src/client-test-prompt.txt", "utf8")


const run = async () => {

    const response = await client.send({
        provider: "kimi",
        // model: "gpt-oss:20b-cloud",
        model: "",
        messages: [{
            role: "user",
            content: userPrompt
        }],
        // optional tool definitions
        tools: [{
            type: "function",
            function: {
                name: "websearch",
                description: "Search the web",
                parameters: {
                    type: "object",
                    properties: {
                        q: { type: "string", description: "The search query" }
                    },
                    required: ["q"]
                }
            }
        }],
        tool_choice: "auto"
    })

    console.log(response.choices[0].message)

    // Get usage information
    // const usage = await client.usage("ollama")
    // console.log("Usage:", usage)
}

run()