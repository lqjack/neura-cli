/** Side-effect import: run before dotenv in neura-cli and verify-related scripts. */
import { loadNeuraCliEnv } from "@/lib/neura-cli/load-cli-env"

loadNeuraCliEnv()
