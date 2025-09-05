import axios from "axios";

export class FaviconHandler{
    async getFavicon(fullUrl: string): Promise<string>{
        try{
            const url = new URL(fullUrl);
            let domain = url.hostname;
            if(domain === 'chatgpt.com') domain = 'chatgpt.co'
            const rawFavicon = await axios.get(`https://img.logo.dev/${domain}?token=pk_Gb5xYqzMT2KthP8ESZj36g&size=144&format=png&retina=true`);
            const faviconBase64 = rawFavicon.data.toString("base64");
            return `data:image/png;base64,${faviconBase64}`;
        } catch (error) {
            return "";
        }
    }
}