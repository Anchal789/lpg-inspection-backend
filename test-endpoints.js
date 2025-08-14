const express = require("express")
const mongoose = require("mongoose")
require("dotenv").config()

// Test script to verify all endpoints are working
const testEndpoints = async () => {
  console.log("🧪 Starting API Endpoint Tests...")

  const baseURL = process.env.API_BASE_URL || "http://localhost:3000/api"

  const tests = [
    {
      name: "Health Check",
      method: "GET",
      endpoint: "/health",
      expectedStatus: 200,
    },
    {
      name: "SAP Code Validation - Super Admin",
      method: "POST",
      endpoint: "/auth/validate-sap",
      data: { sapCode: "000000" },
      expectedStatus: 200,
    },
    {
      name: "SAP Code Validation - Invalid",
      method: "POST",
      endpoint: "/auth/validate-sap",
      data: { sapCode: "INVALID123" },
      expectedStatus: 404,
    },
    {
      name: "Super Admin Login",
      method: "POST",
      endpoint: "/auth/login",
      data: {
        phone: process.env.SUPER_ADMIN_PHONE || "9999999999",
        password: process.env.SUPER_ADMIN_PASSWORD || "admin123",
        sapCode: "000000",
      },
      expectedStatus: 200,
    },
    {
      name: "Register Distributor",
      method: "POST",
      endpoint: "/auth/register-distributor",
      data: {
        sapCode: "TEST12345",
        agencyName: "Test Gas Agency",
        adminName: "Test Admin",
        adminPhone: "9876543210",
        adminPassword: "test123",
        deliveryMen: [
          {
            name: "Test Delivery Man",
            phone: "9876543211",
            password: "delivery123",
          },
        ],
      },
      expectedStatus: 200,
    },
  ]

  let passedTests = 0
  let failedTests = 0

  for (const test of tests) {
    try {
      console.log(`\n🔍 Testing: ${test.name}`)

      const config = {
        method: test.method,
        headers: {
          "Content-Type": "application/json",
        },
      }

      if (test.data) {
        config.body = JSON.stringify(test.data)
      }

      const response = await fetch(`${baseURL}${test.endpoint}`, config)
      const result = await response.json()

      if (response.status === test.expectedStatus) {
        console.log(`✅ ${test.name} - PASSED`)
        console.log(`   Status: ${response.status}`)
        console.log(`   Response: ${JSON.stringify(result, null, 2)}`)
        passedTests++
      } else {
        console.log(`❌ ${test.name} - FAILED`)
        console.log(`   Expected Status: ${test.expectedStatus}`)
        console.log(`   Actual Status: ${response.status}`)
        console.log(`   Response: ${JSON.stringify(result, null, 2)}`)
        failedTests++
      }
    } catch (error) {
      console.log(`❌ ${test.name} - ERROR`)
      console.log(`   Error: ${error.message}`)
      failedTests++
    }
  }

  console.log(`\n📊 Test Results:`)
  console.log(`✅ Passed: ${passedTests}`)
  console.log(`❌ Failed: ${failedTests}`)
  console.log(`📈 Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(2)}%`)
}

// Run tests if this file is executed directly
if (require.main === module) {
  testEndpoints().catch(console.error)
}

module.exports = { testEndpoints }
