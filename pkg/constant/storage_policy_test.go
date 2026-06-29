package constant

import "testing"

func TestStoragePolicyTypeUpyunIsValid(t *testing.T) {
	if !StoragePolicyType("upyun").IsValid() {
		t.Fatal("upyun should be a valid storage policy type")
	}
}
