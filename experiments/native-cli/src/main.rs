use std::io::{self, Write};
use std::process::ExitCode;

const HELP: &[u8] = include_bytes!("help.txt");

fn main() -> ExitCode {
    let mut args = std::env::args_os().skip(1);
    if args.next().as_deref() == Some(std::ffi::OsStr::new("help")) && args.next().is_none() {
        let mut out = io::stdout().lock();
        return match out.write_all(HELP).and_then(|_| out.flush()) {
            Ok(()) => ExitCode::SUCCESS,
            Err(e) if e.kind() == io::ErrorKind::BrokenPipe => ExitCode::SUCCESS,
            Err(e) => {
                eprintln!("neura-native-experiment: {e}");
                ExitCode::FAILURE
            }
        };
    }
    eprintln!("Native experiment only supports `help`. Use the existing `neura` CLI for other commands.");
    ExitCode::from(2)
}
