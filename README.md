# test_giothub_registry

Test Git source for gIoTHub private device types (GIOTHUB-136): one JavaScript
device type with measurement keys, `ch.gimasi.test.gitregistry`, a renamed copy
of the gIoT Store's reference type `com.example.tempsensor`. Installing it from
a tenant's Type sources page checks that the tenant API registers Git-installed
types with the store for their measurement key numbers.

Releases are tags `vX.Y.Z`; the manifest version must match.
