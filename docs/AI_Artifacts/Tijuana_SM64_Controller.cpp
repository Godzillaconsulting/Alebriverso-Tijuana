// Tijuana_SM64_Controller.cpp
// Ingeniería Inversa (Basado en sm64/src/game/mario.c) adaptada a UE 5.7
// -------------------------------------------------------------------------
#include "TijuanaController.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Camera/CameraComponent.h"
#include "Kismet/GameplayStatics.h"

// MACROS SM64 Lógicos
#define ACT_WALKING 0x04000440
#define ACT_JUMPING 0x03000080
#define ACT_WATER_DAMAGE 0x10000A
#define ACT_SELFIE_QTE 0x200001 // Custom Action Alebriverso

ATijuanaController::ATijuanaController()
{
    PrimaryActorTick.bCanEverTick = true;
    
    // ── 1. FÍSICA Y MOMENTUM (sm64_mario_movement_logic) ──
    UCharacterMovementComponent* MoveComp = GetCharacterMovement();
    MoveComp->GravityScale = 2.8f; // Gravedad pesada estilo N64
    MoveComp->MaxAcceleration = 2200.0f; // Arranque progresivo
    MoveComp->BrakingFrictionFactor = 0.35f; // Patinar ligeramente al girar bruscamente (Drift)
    MoveComp->JumpZVelocity = 750.f;
    MoveComp->AirControl = 0.45f; // Permitir ajuste aéreo (fundamental para saltar chinampas)
    
    CurrentActionState = ACT_WALKING;
    ForwardVelocity = 0.0f;
    MaxSpeed = 900.0f;
}

void ATijuanaController::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);
    
    if (CurrentActionState == ACT_SELFIE_QTE) return; // Freeze momentum during selfie
    
    // ── 2. INERCIA DE MOVIMIENTO RELATIVA A LA CÁMARA (sm64 update_mario_velocity) ──
    FVector InputVector = GetLastMovementInputVector();
    float TargetSpeed = InputVector.Size() * MaxSpeed;
    
    if (InputVector.Size() > 0.1f) {
        // Acceleración inercial
        ForwardVelocity = FMath::FInterpTo(ForwardVelocity, TargetSpeed, DeltaTime, 4.0f);
        AddMovementInput(InputVector, ForwardVelocity / MaxSpeed);
    } else {
        // Fricción constante al soltar el analógico
        ForwardVelocity = FMath::FInterpTo(ForwardVelocity, 0.0f, DeltaTime, 10.0f); 
    }
}

// ---------------------------------------------------------
// 3. DETECCIÓN SUPERFICIES TÓXICAS (Water Damage)
// ---------------------------------------------------------
void ATijuanaController::OnWaterTouch(UPrimitiveComponent* OverlappedComp, AActor* OtherActor)
{
    if (OtherActor->ActorHasTag("Lake_Texcoco_Toxic_Bound"))
    {
        CurrentActionState = ACT_WATER_DAMAGE;
        
        // Ejecutar "Visual Glitch" (Evento Blueprint para llamar al material de PostProcess)
        OnTexcocoWaterGlitch(); 
        
        // Matemáticas de Knockback (sm64_take_damage_and_knockback)
        TakeHealthDamage(1);
        LaunchCharacter(FVector(0.f, 0.f, 900.f), true, true); // Expulsar del agua
    }
}

// ---------------------------------------------------------
// 4. MECÁNICA SELFIE QTE (Flash contra Huitzilopochtli)
// ---------------------------------------------------------
void ATijuanaController::ExecuteSelfieQTE(AActor* BossActor)
{
    if (BossActor->ActorHasTag("Boss_Stunned")) 
    {
        CurrentActionState = ACT_SELFIE_QTE;
        GetCharacterMovement()->DisableMovement();
        
        // Interpolación de "Cámara de Hombro Fija" a "GoPro Selfie Cam"
        SwitchToGoProCamera();
        
        // Start Mashing 'X' or 'Space' for 3 seconds
        StartSelfieMashTimer(3.0f); 
    }
}

// Se ejecuta al ganar el mini-juego QTE de la Selfie
void ATijuanaController::OnSelfieQTE_Success()
{
    // Partículas Bit-Pop sincronizadas
    UGameplayStatics::SpawnEmitterAtLocation(GetWorld(), TonalliExplosionVFX, GetActorLocation());
    UGameplayStatics::PlaySound2D(GetWorld(), TonalliBitPopSound);
    
    // Regresar al estado base
    SwitchToChaseCamera();
    GetCharacterMovement()->SetMovementMode(MOVE_Walking);
    CurrentActionState = ACT_WALKING;
}
