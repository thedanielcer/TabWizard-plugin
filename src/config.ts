import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config(/* { path: path.resolve(__dirname, '../.env') } */);

export interface Config {
    // backendUrl: string;
    debugPortPersonal: number;
    debugPortWork: number;
    manualOverridesDirectory: string;
    gitHubIconsDirectory: string;
    // Add other configuration variables here as needed
}

export const config: Config = {
    // backendUrl: process.env.BACKEND_URL || 'ws://127.0.0.1:8766',
    debugPortPersonal: process.env.DEBUG_PORT_PERSONAL as unknown as number || 9223,
    debugPortWork: process.env.DEBUG_PORT_WORK as unknown as number || 9222,
    manualOverridesDirectory: process.env.MANUAL_OVERRIDES_DIRECTORY || "D:\Pictures\Icons\Tab Wizard Manual Overrides",
    gitHubIconsDirectory: process.env.GITHUB_ICONS_DIRECTORY || "D:\Pictures\Icons\GitHub Icons",
    // Add other configuration variables here as needed
};