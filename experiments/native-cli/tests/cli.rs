use std::process::Command;

fn command() -> Command {
    let mut command = Command::new(env!("CARGO_BIN_EXE_neura-native-experiment"));
    command.env_clear();
    command
}

#[test]
fn help_matches_snapshot_without_a_runtime_in_path() {
    let out = command().arg("help").output().unwrap();
    assert!(out.status.success());
    assert!(out.stderr.is_empty());
    assert_eq!(out.stdout, include_bytes!("../src/help.txt"));
}

#[test]
fn unsupported_requests_cannot_dispatch_or_fall_back() {
    for args in [vec![], vec!["--help"], vec!["send", "example"], vec!["help", "extra"]] {
        let out = command().args(args).output().unwrap();
        assert_eq!(out.status.code(), Some(2));
        assert!(out.stdout.is_empty());
        assert!(String::from_utf8_lossy(&out.stderr).contains("Use the existing `neura` CLI"));
    }
}
