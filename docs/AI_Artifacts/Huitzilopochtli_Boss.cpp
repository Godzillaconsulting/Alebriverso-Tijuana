// Huitzilopochtli_Boss.cpp
// Boss Fight State Machine (El Colibrí Zurdo)
// Arena: Cúspide del Templo Mayor
// -------------------------------------------------------------------------

#include "HuitzilopochtliBoss.h"
#include "Kismet/GameplayStatics.h"
#include "Kismet/KismetMathLibrary.h"
#include "TijuanaController.h"

// Enumerador de las Fases del Combate Clásico 3D
UENUM(BlueprintType)
enum class EBossPhase : uint8 {
    INTRO           UMETA(DisplayName = "Cinemática de Aterrizaje"),
    PHASE1_DASH     UMETA(DisplayName = "Barrido con Espada (Macuahuitl)"),
    PHASE2_PILLARS  UMETA(DisplayName = "Invocación de Pilares de Neón"),
    PHASE3_STUNNED  UMETA(DisplayName = "Agotado y Vulnerable (Suelo)")
};

AHuitzilopochtliBoss::AHuitzilopochtliBoss()
{
    PrimaryActorTick.bCanEverTick = true;
    
    CurrentPhase = EBossPhase::INTRO;
    BossHealth = 3; // "3 Hits" clásico de Nintendo 64
    DashSpeed = 2500.f;
    PillarCount = 5;
}

void AHuitzilopochtliBoss::BeginPlay()
{
    Super::BeginPlay();
    ArenaCenter = GetActorLocation(); // El centro de la pirámide plana
    PlayerTarget = UGameplayStatics::GetPlayerCharacter(GetWorld(), 0);
}

void AHuitzilopochtliBoss::Tick(float DeltaTime)
{
    Super::Tick(DeltaTime);

    switch (CurrentPhase)
    {
        case EBossPhase::PHASE1_DASH:
            ExecuteSwordDash(DeltaTime);
            break;
            
        case EBossPhase::PHASE2_PILLARS:
            ExecutePillarSummon(DeltaTime);
            break;
            
        case EBossPhase::PHASE3_STUNNED:
            // Boss inactivo esperando ser golpeado por el jugador
            // Lanza destellos visuales (Mesh->SetScalarParameter("EmissivePulse", sin(Time)))
            PulseVulnerableMaterial(DeltaTime);
            break;
    }
}

// ----------------------------------------------------
// FASE 1: BARRIDO DE ESPADA (Macuahuitl Neón Turquesa)
// ----------------------------------------------------
void AHuitzilopochtliBoss::ExecuteSwordDash(float DeltaTime)
{
    if (bIsDashing)
    {
        // Envestir linealmente e ignorar fricción
        FVector Direction = (TargetDashPos - GetActorLocation()).GetSafeNormal();
        SetActorLocation(GetActorLocation() + (Direction * DashSpeed * DeltaTime));

        // Si llega al extremo de la arena, detener y girar
        if (FVector::DistXY(GetActorLocation(), TargetDashPos) < 100.f)
        {
            bIsDashing = false;
            EndPhaseAttack(); 
        }
    }
    else
    {
        // Calcular la línea de vida del jugador y trazar la envestida a sus espaldas
        if (PlayerTarget) {
            FVector PredictPos = PlayerTarget->GetVelocity() * 0.5f + PlayerTarget->GetActorLocation();
            FRotator FaceDir = UKismetMathLibrary::FindLookAtRotation(GetActorLocation(), PredictPos);
            SetActorRotation(FMath::RInterpTo(GetActorRotation(), FaceDir, DeltaTime, 3.f));
            
            TargetDashPos = PredictPos + (FaceDir.Vector() * 800.f); 
            // bIsDashing se activa mediante AnimNotify al final de la animación de "Alzar la espada"
        }
    }
}

// ----------------------------------------------------
// FASE 2: INVOCACIÓN DE LUZ (Trampas Estáticas)
// ----------------------------------------------------
void AHuitzilopochtliBoss::ExecutePillarSummon(float DeltaTime)
{
    if (bIsSummoning) return; // Solo invoca una vez por ciclo
    
    bIsSummoning = true;
    
    // Spawnear pilares usando RayCasts hacia abajo desde el techo de la arena
    for (int i = 0; i < PillarCount; i++)
    {
        // Offset aleatorio alrededor del jugador
        FVector RandomOffset = FMath::VRand() * FMath::FRandRange(200.f, 900.f);
        RandomOffset.Z = 0;
        
        FVector SpawnPos = PlayerTarget->GetActorLocation() + RandomOffset;
        
        // Generar "Telegraph" visual (Círculo brillante en el suelo) antes que el rayo caiga
        SpawnNeonPillarTelegraph(SpawnPos);
    }
    
    // Agotamiento inducido post-magia
    GetWorldTimerManager().SetTimer(AttackDelayTimer, this, &AHuitzilopochtliBoss::EnterStunnedState, 4.0f, false);
}

// ----------------------------------------------------
// FASE 3: ATURDIMIENTO (Habilitar Ataque Jugador)
// ----------------------------------------------------
void AHuitzilopochtliBoss::EnterStunnedState()
{
    CurrentPhase = EBossPhase::PHASE3_STUNNED;
    SetActorLocation(FVector(ArenaCenter.X, ArenaCenter.Y, ArenaCenter.Z + 100.f)); // Caer al piso
    
    // Habilitar Hitbox de recepción de daño (Hitbox grande en la cabeza/cuerpo central)
    StunHitbox->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
    
    // Vuelve al aire si el jugador no lo ataca en 5 segundos
    GetWorldTimerManager().SetTimer(AttackDelayTimer, this, &AHuitzilopochtliBoss::ResetToPhase1, 5.0f, false);
}

// Evento llamado OnComponentBeginOverlap del Hitbox Aturdido (Si Tijuana ataca)
void AHuitzilopochtliBoss::OnPlayerAttackHit()
{
    BossHealth--;
    StunHitbox->SetCollisionEnabled(ECollisionEnabled::NoCollision); // Inmunidad inmediata
    
    if (BossHealth <= 0)
    {
        // ── QTE INITIATED: SELFIE FLASH ──
        ATijuanaController* PlayerController = Cast<ATijuanaController>(PlayerTarget);
        if (PlayerController) {
            PlayerController->ExecuteSelfieQTE(this);
        }
    }
    else
    {
        // Fase de "Ira" (Rage Mode): Más rápido y más pilares
        DashSpeed += 500.f;
        PillarCount += 3;
        ResetToPhase1();
    }
}
