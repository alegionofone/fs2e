import { registerActorHooks } from "./registration/hooks/actor-hooks.mjs";
import { registerChatHooks } from "./registration/hooks/chat-hooks.mjs";
import { registerInitHooks } from "./registration/hooks/init-hooks.mjs";
import { registerReadyHooks } from "./registration/hooks/ready-hooks.mjs";

registerInitHooks();
registerActorHooks();
registerChatHooks();
registerReadyHooks();
