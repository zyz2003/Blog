package utility

import "testing"

func TestBuildResetPasswordLinkUsesForgotPasswordRoute(t *testing.T) {
	got := buildResetPasswordLink("https://example.com/", "user_public_id", "signed-token")
	want := "https://example.com/forgot-password?id=user_public_id&sign=signed-token"

	if got != want {
		t.Fatalf("reset link = %q, want %q", got, want)
	}
}
